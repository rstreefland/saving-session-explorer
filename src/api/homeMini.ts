import { decimal, type Decimal } from '../domain/decimal';
import {
  Temporal,
  milliseconds,
  instantString,
  addMilliseconds,
  roundHalfHour,
  alignedHalfHour,
} from '../domain/time';
import { numericSchema } from './numericSchema';
import { z } from 'zod';
import { AUTH, graphql } from './transport';
import type { Reading } from '../domain/types';

// Configure before constructing schemas: this module loads before client.ts.
z.config({ jitless: true });

const HALF_HOUR = 1_800_000;
export const DEVICE_QUERY = `query HomeMiniDevices($account: String!) {
  account(accountNumber: $account) {
    electricityAgreements(active: true) {
      meterPoint { mpan meters(includeInactive: false) {
        serialNumber smartImportElectricityMeter { deviceId }
      } }
    }
  }
}`;
export const TELEMETRY_QUERY = `query HomeMiniReadings($device: String!, $start: DateTime!, $end: DateTime!) {
  smartMeterTelemetry(deviceId: $device, grouping: HALF_HOURLY, start: $start, end: $end) {
    readAt consumptionDelta
  }
}`;
const devicesSchema = z.object({
  account: z.object({
    electricityAgreements: z.array(
      z.object({
        meterPoint: z.object({
          mpan: z.string(),
          meters: z.array(
            z.object({
              serialNumber: z.string(),
              smartImportElectricityMeter: z.object({ deviceId: z.string() }).nullable(),
            }),
          ),
        }),
      }),
    ),
  }),
});
const telemetrySchema = z.object({
  smartMeterTelemetry: z.array(
    z.object({
      readAt: z.string().datetime({ offset: true }),
      consumptionDelta: z.union([z.string(), z.number()]).nullable(),
    }),
  ),
});

/** Never replace an existing meter row, even an invalid or conflicting one. */
export function mergeHomeMini(
  readings: Reading[],
  raw: unknown,
  start: number,
  end: number,
): Reading[] {
  const occupied = new Set(readings.map((r) => milliseconds(r.interval_start)));
  const telemetry = telemetrySchema.parse(raw).smartMeterTelemetry;
  const counts = new Map<number, Decimal>();
  // Count raw timestamps before discarding unusable values: an invalid duplicate
  // still makes the interval ambiguous, including equivalent timestamp offsets.
  for (const row of telemetry) {
    const time = milliseconds(row.readAt);
    counts.set(time, decimal(counts.get(time) ?? 0).plus(1));
  }
  const candidates: Reading[] = telemetry.flatMap<Reading>((row) => {
    const time = milliseconds(row.readAt);
    const parsed = numericSchema.safeParse(
      typeof row.consumptionDelta === 'string' ? row.consumptionDelta.trim() : row.consumptionDelta,
    );
    const value = parsed.success ? decimal(parsed.data).div(1000) : null;
    return time >= start &&
      addMilliseconds(time, HALF_HOUR) <= end &&
      alignedHalfHour(row.readAt) &&
      counts.get(time)?.eq(1) === true &&
      value !== null &&
      value.gte(0)
      ? [
          {
            interval_start: instantString(time),
            interval_end: instantString(addMilliseconds(time, HALF_HOUR)),
            consumption: value.toString(),
            source: 'home-mini',
          },
        ]
      : [];
  });
  return [...readings, ...candidates.filter((r) => !occupied.has(milliseconds(r.interval_start)))];
}

export async function fillHomeMiniGaps(options: {
  account: string;
  token: string;
  mpan: string;
  serial: string;
  from: string;
  to: string;
  readings: Reading[];
  signal: AbortSignal;
  now?: number;
}): Promise<{ readings: Reading[]; unavailable: boolean }> {
  const { signal } = options;
  const now = options.now ?? Temporal.Now.instant().epochMilliseconds;
  // Stay inside the rolling 30-day retention boundary, including during requests.
  const oldest = Temporal.Instant.fromEpochMilliseconds(now).subtract({
    hours: 696,
  }).epochMilliseconds;
  const fromTime = milliseconds(options.from);
  const toTime = milliseconds(options.to);
  const start = roundHalfHour(fromTime > oldest ? fromTime : oldest, 'ceil');
  const end = roundHalfHour(toTime < now ? toTime : now, 'floor');
  let readings = options.readings;
  const occupied = new Set(readings.map((r) => milliseconds(r.interval_start)));
  const windows: [number, number][] = [];
  for (
    let day = Temporal.Instant.fromEpochMilliseconds(start).toZonedDateTimeISO('UTC').startOfDay();
    day.epochMilliseconds < end;
    day = day.add({ days: 1 })
  ) {
    const from = start > day.epochMilliseconds ? start : day.epochMilliseconds,
      nextDay = day.add({ days: 1 }).epochMilliseconds,
      to = end < nextDay ? end : nextDay;
    for (let time = from; time < to; time = addMilliseconds(time, HALF_HOUR)) {
      if (!occupied.has(time)) {
        windows.push([from, to]);
        break;
      }
    }
  }
  if (!windows.length) return { readings, unavailable: false };
  try {
    const data = devicesSchema.parse(
      await graphql(AUTH, DEVICE_QUERY, { account: options.account }, signal, options.token),
    );
    const ids = new Set(
      data.account.electricityAgreements.flatMap((a) =>
        a.meterPoint.mpan === options.mpan
          ? a.meterPoint.meters
              .filter((m) => m.serialNumber === options.serial)
              .flatMap((m) =>
                m.smartImportElectricityMeter ? [m.smartImportElectricityMeter.deviceId] : [],
              )
          : [],
      ),
    );
    if (ids.size !== 1) return { readings, unavailable: false };
    const device = [...ids][0];
    // Daily requests work where larger telemetry ranges can fail. Stop on failure
    // (including rate limiting), preserving any successful days and standard data.
    for (const [from, to] of windows.reverse()) {
      const raw = await graphql(
        AUTH,
        TELEMETRY_QUERY,
        { device, start: instantString(from), end: instantString(to) },
        signal,
        options.token,
      );
      readings = mergeHomeMini(readings, raw, from, to);
    }
    return { readings, unavailable: false };
  } catch (error) {
    if (signal.aborted) throw error;
    return { readings, unavailable: true };
  }
}
