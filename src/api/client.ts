import { z } from 'zod';
import { MeterDiscoveryCache } from './meterDiscovery';
import { inferHolidayRegion } from '../domain/region';
import { Temporal, midnight, local, milliseconds } from '../domain/time';
import type { BaselineIssue, Dataset, Reading } from '../domain/types';

// Avoid runtime code generation, including Zod's eval probe, under the production CSP.
z.config({ jitless: true });

export const GRAPHQL = 'https://api.backend.octopus.energy/v1/graphql/';
export const AUTH = 'https://api.oegb-kraken.energy/v1/graphql/';
const REST = 'https://api.oegb-kraken.energy/v1/';

const nullable = z.number().finite().nullable();
const iso = z.string().datetime({ offset: true });

const sessionSchema = z.object({
  eventId: z.number(),
  startAt: iso,
  endAt: iso,
  eventType: z.string(),
  resultsStatus: z.string().nullable(),
  resultsSetAt: iso.nullable(),
  energyDeltaKwh: nullable,
  baselineConsumptionDeltaKwh: nullable,
  consumptionDeltaKwh: nullable,
  rewardGivenInOctoPoints: nullable,
  rewardGivenInPence: nullable.nullish(),
  energyUsedInKwh: nullable.nullish(),
});

const readingSchema = z.object({
  interval_start: iso,
  interval_end: iso,
  consumption: z.number().finite(),
});

const meterPoint = z.object({
  mpan: z.string(),
  is_export: z.boolean(),
  meters: z.array(z.object({ serial_number: z.string() })),
});

export const accountSchema = z.object({
  properties: z.array(
    z.object({
      electricity_meter_points: z.array(meterPoint),
    }),
  ),
});

export type Account = z.infer<typeof accountSchema>;

export const SESSION_QUERY = `query Sessions($account: String!) {
  savingSessions {
    events { id startAt endAt rewardPerKwhInOctoPoints }
    eventCount
    account(accountNumber: $account) {
      signedUpMeterPoint { mpan gspGroupId }
      joinedEvents { eventId startAt endAt eventType resultsStatus resultsSetAt
        energyDeltaKwh baselineConsumptionDeltaKwh consumptionDeltaKwh rewardGivenInOctoPoints rewardGivenInPence energyUsedInKwh }
    }
  }
}`;

async function json(url: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, { ...init, signal });
  } catch (e) {
    if (signal.aborted) throw e;

    throw new Error(
      'Could not reach Octopus or GOV.UK. Check your connection; browser CORS restrictions may also block access.',
    );
  }

  if (!response.ok)
    throw new Error(
      response.status === 401 || response.status === 403
        ? 'Octopus rejected these credentials. Check your API key and account number.'
        : response.status === 429
          ? 'Octopus rate limit reached. Please wait before refreshing.'
          : `Service returned HTTP ${response.status}. Please try again.`,
    );

  return response.json();
}

export async function graphql(
  url: string,
  query: string,
  variables: Record<string, unknown>,
  signal: AbortSignal,
  token?: string,
) {
  const raw = await json(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
      body: JSON.stringify({ query, variables }),
    },
    signal,
  );

  const envelope = z
    .object({ data: z.unknown().optional(), errors: z.array(z.unknown()).optional() })
    .parse(raw);

  // Never echo upstream error messages: these can contain personal data or credentials.
  if (envelope.errors?.length || !envelope.data)
    throw new Error(
      'Octopus could not complete the query. Check credentials and account access; its API may have changed.',
    );

  return envelope.data;
}

export async function fetchAccount(
  key: string,
  account: string,
  signal: AbortSignal,
): Promise<Account> {
  return accountSchema.parse(
    await json(
      `${REST}accounts/${encodeURIComponent(account)}/`,
      { headers: { Authorization: `Basic ${btoa(key + ':')}` } },
      signal,
    ),
  );
}

function consumptionUrl(mpan: string, serial: string, parameters: Record<string, string>) {
  return `${REST}electricity-meter-points/${encodeURIComponent(mpan)}/meters/${encodeURIComponent(serial)}/consumption/?${new URLSearchParams(parameters)}`;
}

async function* readingPages(key: string, firstUrl: string, signal: AbortSignal, maxPages = 100) {
  let next: string | null = firstUrl;
  const seen = new Set<string>();

  while (next) {
    if (!next.startsWith(REST) || seen.has(next) || seen.size >= maxPages)
      throw new Error('Unexpected Octopus pagination link.');

    seen.add(next);

    const page = z
      .object({ next: z.string().nullable(), results: z.array(readingSchema) })
      .parse(await json(next, { headers: { Authorization: `Basic ${btoa(key + ':')}` } }, signal));

    yield page.results;
    next = page.next;
  }
}

export async function fetchReadings(
  key: string,
  mpan: string,
  serial: string,
  from: string,
  to: string,
  signal: AbortSignal,
): Promise<Reading[]> {
  const readings: Reading[] = [];

  const url = consumptionUrl(mpan, serial, {
    period_from: from,
    period_to: to,
    page_size: '25000',
    order_by: 'period',
  });

  for await (const page of readingPages(key, url, signal)) readings.push(...page);

  return readings;
}

type MeterPoint = z.infer<typeof meterPoint>;

/** Compare actual half-hour readings, rather than account API ordering or installation dates. */
export async function selectMeter(
  key: string,
  point: MeterPoint,
  signal: AbortSignal,
): Promise<string> {
  const serials = [...new Set(point.meters.map((meter) => meter.serial_number))].sort();

  if (serials.length === 0)
    throw new Error('Octopus returned no electricity meter for the registered meter point.');

  if (serials.length === 1) return serials[0];

  const candidates = await Promise.all(
    serials.map(async (serial) => {
      const url = consumptionUrl(point.mpan, serial, { page_size: '100', order_by: '-period' });

      for await (const page of readingPages(key, url, signal, 10)) {
        const valid = page.filter((reading) => {
          const start = milliseconds(reading.interval_start);

          return (
            reading.consumption >= 0 &&
            start % 1_800_000 === 0 &&
            milliseconds(reading.interval_end) - start === 1_800_000
          );
        });

        if (valid.length)
          return {
            serial,
            latest: Math.max(...valid.map((reading) => milliseconds(reading.interval_end))),
          };
      }

      return { serial, latest: null };
    }),
  );

  // Sorting serials first makes ties deterministic, independent of API response order.
  const selected = candidates.reduce<(typeof candidates)[number] | null>(
    (best, candidate) =>
      candidate.latest !== null && (best === null || candidate.latest > best.latest!)
        ? candidate
        : best,
    null,
  );

  if (!selected)
    throw new Error(
      'No half-hourly readings were found for these electricity meters. Check that your smart meter is sending half-hourly data.',
    );

  return selected.serial;
}

export interface LoadOptions {
  key: string;
  account: string;
  from: string;
  to: string;
  region: string;
}

async function fetchAccountProfile(account: string, token: string, signal: AbortSignal) {
  try {
    const data = await graphql(
      AUTH,
      'query AccountProfile($account: String!) { account(accountNumber: $account) { number billingName } }',
      { account },
      signal,
      token,
    );

    return z
      .object({
        account: z
          .object({ number: z.string().nullable(), billingName: z.string().nullable() })
          .nullable(),
      })
      .parse(data).account;
  } catch (error) {
    if (signal.aborted) throw error;

    // Profile information is optional; it must not prevent meter results from loading.
    return null;
  }
}

/** A failed optional dependency must not hide usable import-only Happy Hour results. */
async function optionalDependency<T>(load: () => Promise<T>, signal: AbortSignal) {
  try {
    return { available: true as const, value: await load() };
  } catch (error) {
    if (signal.aborted) throw error;

    return { available: false as const };
  }
}

export async function loadDataset(
  options: LoadOptions,
  signal: AbortSignal,
  discovery = new MeterDiscoveryCache(),
): Promise<Dataset> {
  const { key, account, from, to, region } = options;

  const auth = z
    .object({ obtainKrakenToken: z.object({ token: z.string() }) })
    .parse(
      await graphql(
        AUTH,
        'mutation Token($key: String!) { obtainKrakenToken(input: { APIKey: $key }) { token } }',
        { key },
        signal,
      ),
    );

  const [rawSessions, details, rawHolidays, profile] = await Promise.all([
    graphql(GRAPHQL, SESSION_QUERY, { account }, signal, auth.obtainKrakenToken.token),
    fetchAccount(key, account, signal),
    optionalDependency(
      async () =>
        z
          .record(z.string(), z.object({ events: z.array(z.object({ date: z.string().date() })) }))
          .parse(await json('https://www.gov.uk/bank-holidays.json', {}, signal)),
      signal,
    ),
    fetchAccountProfile(account, auth.obtainKrakenToken.token, signal),
  ]);

  const data = z
    .object({
      savingSessions: z.object({
        events: z.array(
          z.object({
            id: z.number(),
            startAt: iso,
            endAt: iso,
            rewardPerKwhInOctoPoints: z.number().finite().nonnegative().nullish().catch(null),
          }),
        ),
        eventCount: z.number(),
        account: z
          .object({
            signedUpMeterPoint: z.object({ mpan: z.string(), gspGroupId: z.string() }).nullable(),
            joinedEvents: z.array(sessionSchema),
          })
          .nullable(),
      }),
    })
    .parse(rawSessions).savingSessions;

  if (!data.account?.signedUpMeterPoint)
    throw new Error(
      'No electricity meter is registered for Saving Sessions. Join Octoplus with a smart meter sending half-hourly readings.',
    );

  const mpan = data.account.signedUpMeterPoint.mpan;

  const property = details.properties.find((p) =>
    p.electricity_meter_points.some((m) => m.mpan === mpan),
  );

  const imports = property?.electricity_meter_points.find((m) => m.mpan === mpan && !m.is_export);
  const exports = property?.electricity_meter_points.filter((m) => m.is_export) ?? [];

  if (!imports) throw new Error('Could not identify the registered import meter point.');

  const selectedRegion =
    region === 'auto' ? inferHolidayRegion(data.account.signedUpMeterPoint.gspGroupId) : region;

  const baselineIssues: BaselineIssue[] = [];

  const holidays =
    rawHolidays.available && selectedRegion
      ? rawHolidays.value[selectedRegion]?.events.map((e) => e.date)
      : undefined;

  if (!holidays) baselineIssues.push('holidays');

  const start = midnight(from);
  const end = midnight(to).add({ days: 1 });
  const historyStart = start.subtract({ days: 60 }).toInstant().toString();

  const select = (point: MeterPoint) =>
    discovery.select(
      point.mpan,
      point.meters.map((meter) => meter.serial_number),
      signal,
      () => selectMeter(key, point, signal),
    );

  const [importMeter, linkedExport] = await Promise.all([
    (async () => {
      const serial = await select(imports);

      const readings = await fetchReadings(
        key,
        mpan,
        serial,
        historyStart,
        end.toInstant().toString(),
        signal,
      );

      return { serial, readings };
    })(),
    optionalDependency(async () => {
      if (exports.length === 0) return null;
      if (exports.length !== 1) throw new Error('Ambiguous export meter points.');

      const serial = await select(exports[0]);

      const readings = await fetchReadings(
        key,
        exports[0].mpan,
        serial,
        historyStart,
        end.toInstant().toString(),
        signal,
      );

      return { serial, readings };
    }, signal),
  ]);

  if (!linkedExport.available) baselineIssues.push('exports');
  // The API count establishes completeness; the oldest event is not a coverage boundary.
  if (data.events.length !== data.eventCount) baselineIssues.push('event-history');

  const eventDays = new Set<string>();

  for (const event of [...data.events, ...data.account.joinedEvents]) {
    for (
      let d = local(event.startAt).startOfDay();
      d.epochMilliseconds < milliseconds(event.endAt);
      d = d.add({ days: 1 })
    )
      eventDays.add(d.toPlainDate().toString());
  }

  const eventRates = new Map(
    data.events.map((event) => [event.id, event.rewardPerKwhInOctoPoints]),
  );

  return {
    sessions: data.account.joinedEvents
      .filter(
        (s) =>
          milliseconds(s.startAt) >= start.epochMilliseconds &&
          milliseconds(s.startAt) < end.epochMilliseconds &&
          milliseconds(s.endAt) <= Temporal.Now.instant().epochMilliseconds,
      )
      .map((session) => ({
        ...session,
        rewardPerKwhInOctoPoints: eventRates.get(session.eventId) ?? null,
      })),
    eventDays: [...eventDays],
    imports: importMeter.readings,
    exports: linkedExport.available ? (linkedExport.value?.readings ?? null) : [],
    holidays: holidays ?? [],
    baselineIssues,
    warnings: [],
    fetchedAt: Temporal.Now.instant().toString(),
    mpan,
    accountNumber: profile?.number?.trim() || account,
    accountHolderName: profile?.billingName?.trim() || null,
    meterSerials: {
      import: importMeter.serial,
      export: linkedExport.available ? (linkedExport.value?.serial ?? null) : null,
    },
    holidayRegion: selectedRegion ?? undefined,
    holidayRegionSource: region === 'auto' ? 'Octopus grid supply point' : 'Manual override',
  };
}

/** Each mounted app owns its loader; account/key changes discard discovery results. */
export function createDatasetLoader() {
  let scope: { key: string; account: string; discovery: MeterDiscoveryCache } | null = null;

  return Object.assign(
    (options: LoadOptions, signal: AbortSignal) => {
      if (!scope || scope.key !== options.key || scope.account !== options.account)
        scope = {
          key: options.key,
          account: options.account,
          discovery: new MeterDiscoveryCache(),
        };

      return loadDataset(options, signal, scope.discovery);
    },
    {
      clear: () => {
        scope = null;
      },
    },
  );
}
