import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { demoDataset } from '../domain/demo';
import { todayInLondon } from '../domain/time';
import { describe, it, expect, vi } from 'vitest';
import { dataWarnings } from '../domain/availability';
import { calculateAll } from '../domain/calculate';
import type { Session } from '../domain/types';
import {
  fetchReadings,
  graphql,
  loadDataset,
  selectMeter,
  createDatasetLoader,
  AUTH,
  GRAPHQL,
} from './client';

const signal = () => new AbortController().signal;

const response = (data: unknown, status = 200) =>
  ({ ok: status === 200, status, json: async () => data }) as Response;

const mockFetch = (values: unknown[]) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => response(values.shift())),
  );

const reading = {
  interval_start: '2026-11-01T00:00:00Z',
  interval_end: '2026-11-01T00:30:00Z',
  consumption: 0.2,
};

describe('API transport', () => {
  it('paginates readings and sends Basic auth only to Octopus', async () => {
    mockFetch([
      { results: [reading], next: 'https://api.oegb-kraken.energy/v1/next/' },
      { results: [reading], next: null },
    ]);

    expect(await fetchReadings('secret', '123', 'ABC', 'from', 'to', signal())).toHaveLength(2);
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toEqual({
      Authorization: 'Basic ' + btoa('secret:'),
    });
  });

  it.each([
    'https://evil.test/',
    'https://api.oegb-kraken.energy.evil.test/v1/',
    'https://api.octopus.energy/v1/next/',
  ])('rejects foreign next links: %s', async (next) => {
    mockFetch([{ results: [], next }]);

    await expect(fetchReadings('secret', '123', 'ABC', 'f', 't', signal())).rejects.toThrow(
      'pagination',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects pagination loops', async () => {
    mockFetch([
      { results: [], next: 'https://api.oegb-kraken.energy/v1/next/' },
      { results: [], next: 'https://api.oegb-kraken.energy/v1/next/' },
    ]);

    await expect(fetchReadings('x', '1', '2', 'f', 't', signal())).rejects.toThrow('pagination');
  });

  it.each([401, 403, 429, 500])('handles HTTP %s', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, status)));

    await expect(graphql(AUTH, '{}', {}, signal())).rejects.toThrow(
      status === 429 ? 'rate limit' : status === 500 ? 'HTTP' : 'credentials',
    );
  });

  it('sanitizes GraphQL errors and rejects partial success', async () => {
    mockFetch([{ data: { some: 'data' }, errors: [{ message: 'secret' }] }]);

    await expect(graphql(AUTH, '{}', {}, signal())).rejects.toThrow('could not complete');
  });

  it('reports network/CORS failures and preserves aborts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    await expect(graphql(AUTH, '{}', {}, signal())).rejects.toThrow('CORS');

    const c = new AbortController();

    c.abort();

    await expect(graphql(AUTH, '{}', {}, c.signal)).rejects.toThrow('network');
  });

  it('rejects invalid readings', async () => {
    mockFetch([{ results: [{ ...reading, consumption: null }], next: null }]);

    await expect(fetchReadings('x', '1', '2', 'f', 't', signal())).rejects.toThrow();
  });
});

const options = {
  key: 'test-key',
  account: 'A-123',
  region: 'england-and-wales',
  from: '2026-10-01',
  to: '2026-11-01',
};

function setup({
  holderName = 'Test Account Holder' as string | null,
  profileUnavailable = false,
  joinedEvents = [] as Session[],
  registered = true,
  gsp = '_A',
  meters = 1,
  calendar = true,
  rewardRate = undefined as unknown,
  exports = false,
  region = true,
  exportFailure = '' as '' | 'discovery' | 'readings',
  holidayFailure = false,
  meterReadings = {} as Record<string, (typeof reading)[]>,
} = {}) {
  const calls: string[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push(url);

      if (url === AUTH) {
        const query = JSON.parse(init.body as string).query as string;

        if (query.includes('obtainKrakenToken'))
          return response({ data: { obtainKrakenToken: { token: 'jwt' } } });

        return profileUnavailable
          ? response({ errors: [{ message: 'Profile unavailable' }] })
          : response({ data: { account: { number: 'A-123', billingName: holderName } } });
      }

      if (url === GRAPHQL)
        return response({
          data: {
            savingSessions: {
              events: calendar
                ? [
                    {
                      id: 1,
                      startAt: '2026-01-01T17:00:00Z',
                      endAt: '2026-01-01T18:00:00Z',
                      rewardPerKwhInOctoPoints: rewardRate,
                    },
                  ]
                : [],
              eventCount: 1,
              account: {
                signedUpMeterPoint: registered ? { mpan: '123', gspGroupId: gsp } : null,
                joinedEvents,
              },
            },
          },
        });

      if (url.includes('accounts/'))
        return response({
          properties: [
            {
              electricity_meter_points: [
                {
                  mpan: '123',
                  is_export: false,
                  meters: Array.from({ length: meters }, (_, index) => ({
                    serial_number: index === 0 ? 'ABC' : 'REPLACEMENT',
                  })),
                },
                ...(exports
                  ? [
                      {
                        mpan: '456',
                        is_export: true,
                        meters:
                          exportFailure === 'discovery'
                            ? [{ serial_number: 'EXP' }, { serial_number: 'OLD-EXP' }]
                            : [{ serial_number: 'EXP' }],
                      },
                    ]
                  : []),
              ],
            },
          ],
        });

      if (url.includes('gov.uk'))
        return holidayFailure
          ? response({}, 503)
          : response(region ? { 'england-and-wales': { events: [{ date: '2026-08-31' }] } } : {});

      expect((init.headers as Record<string, string>).Authorization).toContain('Basic');

      const serial = decodeURIComponent(url.split('/meters/')[1].split('/')[0]);

      if (exportFailure && serial.includes('EXP')) return response({}, 503);

      return response({ results: meterReadings[serial] ?? [reading], next: null });
    }),
  );

  return calls;
}

describe('dataset orchestration', () => {
  it('uses migrated backend, registered MPAN, 60 extra days and holiday calendar', async () => {
    const calls = setup();
    const data = await loadDataset(options, signal());

    expect(data.mpan).toBe('123');
    expect(data.accountNumber).toBe('A-123');
    expect(data.accountHolderName).toBe('Test Account Holder');
    expect(data.holidays).toEqual(['2026-08-31']);
    expect(data.warnings).toEqual([]);
    expect(calls.find((c) => c.includes('consumption'))).toContain('2026-08-01T23');
    expect(vi.mocked(fetch).mock.calls.find((c) => c[0] === GRAPHQL)?.[1]?.headers).toMatchObject({
      Authorization: 'jwt',
    });
  });

  it('loads linked export', async () => {
    setup({ exports: true });

    expect((await loadDataset(options, signal())).exports).toHaveLength(1);
  });

  it('warns on incomplete calendar', async () => {
    setup({ calendar: false });

    expect((await loadDataset(options, signal())).baselineIssues).toEqual(['event-history']);
  });

  it('explains registration and smart meter requirements', async () => {
    setup({ registered: false });

    await expect(loadDataset(options, signal())).rejects.toThrow('half-hourly');
  });

  it('loads accounts with replacement meters and records the selected serial', async () => {
    const oldReading = {
      ...reading,
      interval_start: '2025-01-01T00:00:00Z',
      interval_end: '2025-01-01T00:30:00Z',
    };

    const calls = setup({
      meters: 2,
      meterReadings: { ABC: [oldReading], REPLACEMENT: [reading] },
    });

    const data = await loadDataset(options, signal());

    expect(data.meterSerials).toEqual({ import: 'REPLACEMENT', export: null });

    const historyCalls = calls.filter((url) => url.includes('period_from='));

    expect(historyCalls).toHaveLength(1);
    expect(historyCalls[0]).toContain('/meters/REPLACEMENT/');
    expect(data.imports).toEqual([reading]);
  });

  it('retains data but blocks baseline estimates without verified holidays', async () => {
    setup({ region: false });

    expect(dataWarnings(await loadDataset(options, signal())).join()).toContain(
      'Bank holidays could not be verified',
    );
  });
});

it('infers bank holiday region from the registered meter GSP group', async () => {
  setup();

  const data = await loadDataset({ ...options, region: 'auto' }, signal());

  expect(data.holidayRegion).toBe('england-and-wales');
  expect(data.holidayRegionSource).toBe('Octopus grid supply point');
});

it('retains import-only results for an unknown GSP', async () => {
  setup({ gsp: '_Z' });

  const data = await loadDataset({ ...options, region: 'auto' }, signal());

  expect(data.holidayRegion).toBeUndefined();
  expect(dataWarnings(data).join()).toContain('Bank holidays could not be verified');
});

it('allows a manual override even for an unknown GSP', async () => {
  setup({ gsp: '_Z' });

  expect((await loadDataset(options, signal())).holidayRegionSource).toBe('Manual override');
});

describe('meter selection', () => {
  const point = (serials = ['OLD', 'NEW']) => ({
    mpan: '123',
    is_export: false,
    meters: serials.map((serial_number) => ({ serial_number })),
  });

  const oldReading = {
    ...reading,
    interval_start: '2025-01-01T00:00:00Z',
    interval_end: '2025-01-01T00:30:00Z',
  };

  function meterResponses(pages: Record<string, unknown[]>) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const serial = decodeURIComponent(url.split('/meters/')[1].split('/')[0]);

        return response(pages[serial].shift());
      }),
    );
  }

  it.each([
    ['OLD', 'NEW'],
    ['NEW', 'OLD'],
  ])(
    'selects the newest half-hourly meter regardless of account ordering (%s, %s)',
    async (first, second) => {
      meterResponses({
        OLD: [{ results: [oldReading], next: null }],
        NEW: [{ results: [reading], next: null }],
      });

      expect(await selectMeter('key', point([first, second]), signal())).toBe('NEW');

      for (const [url] of vi.mocked(fetch).mock.calls) {
        const params = new URL(String(url)).searchParams;

        expect(params.get('order_by')).toBe('-period');
        expect(params.has('period_from')).toBe(false);
        expect(params.has('period_to')).toBe(false);
      }
    },
  );

  it('ignores more recent daily or invalid readings, and accepts zero consumption', async () => {
    meterResponses({
      OLD: [
        {
          results: [
            { ...reading, interval_end: '2026-11-02T00:00:00Z' },
            { ...reading, consumption: -1 },
            {
              ...oldReading,
              interval_start: '2025-01-01T00:01:00Z',
              interval_end: '2025-01-01T00:31:00Z',
            },
          ],
          next: null,
        },
      ],
      NEW: [{ results: [{ ...oldReading, consumption: 0 }], next: null }],
    });

    expect(await selectMeter('key', point(), signal())).toBe('NEW');
  });

  it('checks the next page if the first has no half-hourly readings', async () => {
    meterResponses({
      OLD: [{ results: [oldReading], next: null }],
      NEW: [
        {
          results: [{ ...reading, interval_end: '2026-11-02T00:00:00Z' }],
          next: 'https://api.oegb-kraken.energy/v1/electricity-meter-points/123/meters/NEW/consumption/?page=2',
        },
        { results: [reading], next: null },
      ],
    });

    expect(await selectMeter('key', point(), signal())).toBe('NEW');
  });

  it('does not probe a single meter or duplicate serial entries', async () => {
    vi.stubGlobal('fetch', vi.fn());

    expect(await selectMeter('key', point(['ONE', 'ONE']), signal())).toBe('ONE');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('explains missing half-hourly data rather than guessing a meter', async () => {
    meterResponses({ OLD: [{ results: [], next: null }], NEW: [{ results: [], next: null }] });

    await expect(selectMeter('key', point(), signal())).rejects.toThrow('No half-hourly readings');
    await expect(selectMeter('key', point([]), signal())).rejects.toThrow('no electricity meter');
  });

  it('bounds meter-discovery pagination and refuses to guess after the limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const next = new URL(url);

        next.searchParams.set('page', String(Number(next.searchParams.get('page') ?? 1) + 1));

        return response({ results: [], next: next.toString() });
      }),
    );

    await expect(selectMeter('key', point(), signal())).rejects.toThrow('pagination');
    expect(fetch).toHaveBeenCalledTimes(20); // At most ten pages for each of two candidates.
  });

  it('does not silently ignore failures while comparing meters', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 401)));

    await expect(selectMeter('key', point(), signal())).rejects.toThrow('credentials');
  });
});

it('returns all three session types and keeps their event days for baseline exclusions', async () => {
  const base: Session = {
    eventId: 100,
    startAt: '2026-10-15T17:00:00Z',
    endAt: '2026-10-15T18:00:00Z',
    eventType: 'TURN_DOWN',
    resultsStatus: 'SUCCESS',
    resultsSetAt: null,
    energyDeltaKwh: 0.5,
    baselineConsumptionDeltaKwh: 0.7,
    consumptionDeltaKwh: 0.2,
    rewardGivenInOctoPoints: 40,
  };

  setup({
    joinedEvents: [
      base,
      {
        ...base,
        eventId: 101,
        eventType: 'TURN_UP',
        startAt: '2026-10-16T17:00:00Z',
        endAt: '2026-10-16T18:00:00Z',
      },
      {
        ...base,
        eventId: 102,
        eventType: 'WEEKEND_HAPPY_HOUR',
        startAt: '2026-10-17T17:00:00Z',
        endAt: '2026-10-17T18:00:00Z',
      },
    ],
  });

  const data = await loadDataset(options, signal());

  expect(data.sessions.map((session) => session.eventType)).toEqual([
    'TURN_DOWN',
    'TURN_UP',
    'WEEKEND_HAPPY_HOUR',
  ]);
  expect(data.eventDays).toEqual(
    expect.arrayContaining(['2026-10-15', '2026-10-16', '2026-10-17']),
  );
});

it('keeps meter results available when the account holder profile is unavailable', async () => {
  setup({ profileUnavailable: true });

  const data = await loadDataset(options, signal());

  expect(data.accountNumber).toBe('A-123');
  expect(data.accountHolderName).toBeNull();
  expect(data.imports).toHaveLength(1);
});

it('handles a missing or blank billing name without inventing a name', async () => {
  setup({ holderName: '   ' });

  expect((await loadDataset(options, signal())).accountHolderName).toBeNull();
});

it.each([80, 0, null, undefined, -1, 'invalid'])(
  'matches reward rates by event ID and tolerates absent or invalid metadata (%s)',
  async (rewardRate) => {
    const session: Session = {
      eventId: 1,
      startAt: '2026-10-15T17:00:00Z',
      endAt: '2026-10-15T18:00:00Z',
      eventType: 'TURN_DOWN',
      resultsStatus: 'SUCCESS',
      resultsSetAt: null,
      energyDeltaKwh: 1,
      baselineConsumptionDeltaKwh: 2,
      consumptionDeltaKwh: 1,
      rewardGivenInOctoPoints: 999,
    };

    setup({ rewardRate, joinedEvents: [session, { ...session, eventId: 99 }] });

    const data = await loadDataset(options, signal());

    expect(data.sessions.find((s) => s.eventId === 1)?.rewardPerKwhInOctoPoints).toBe(
      typeof rewardRate === 'number' && rewardRate >= 0 ? rewardRate : null,
    );
    expect(data.sessions.find((s) => s.eventId === 99)?.rewardPerKwhInOctoPoints).toBeNull();
    expect(data.imports).toHaveLength(1);

    const request = vi.mocked(fetch).mock.calls.find((call) => call[0] === GRAPHQL)!;

    expect(JSON.parse(request[1]!.body as string).query).toContain('rewardPerKwhInOctoPoints');
  },
);

const happyHour: Session = {
  eventId: 2,
  startAt: reading.interval_start,
  endAt: reading.interval_end,
  eventType: 'WEEKEND_HAPPY_HOUR',
  resultsStatus: 'SUCCESS',
  resultsSetAt: null,
  energyDeltaKwh: null,
  baselineConsumptionDeltaKwh: null,
  consumptionDeltaKwh: null,
  rewardGivenInOctoPoints: null,
  energyUsedInKwh: 0.2,
  rewardGivenInPence: 4,
};

it.each(['discovery', 'readings'] as const)(
  'preserves Happy Hours when export %s fails',
  async (exportFailure) => {
    setup({
      exports: true,
      exportFailure,
      joinedEvents: [happyHour, { ...happyHour, eventId: 3, eventType: 'TURN_DOWN' }],
    });

    const data = await loadDataset(options, signal());

    expect(data.baselineIssues).toContain('exports');
    expect(data.exports).toEqual([]); // Unknown exports must never become zero-export data.

    const results = calculateAll(data);

    expect(results.find((r) => r.session.eventId === 2)).toMatchObject({
      actual: 0.2,
      rewarded: 0.2,
      state: 'match',
    });
    expect(results.find((r) => r.session.eventId === 3)?.rewarded).toBeNull();
    expect(dataWarnings(data).join()).toContain('Linked export readings could not be loaded');
  },
);

it('preserves Happy Hours when the holiday service is unavailable', async () => {
  setup({ holidayFailure: true, joinedEvents: [happyHour] });

  const data = await loadDataset(options, signal());

  expect(dataWarnings(data).join()).toContain('Bank holidays could not be verified');
  expect(calculateAll(data)[0]).toMatchObject({ actual: 0.2, rewarded: 0.2, state: 'match' });
});

it('reuses meter discovery across ranges and refreshes, but never across private account scopes', async () => {
  const calls = setup({ meters: 2 });
  const load = createDatasetLoader();
  const probes = () => calls.filter((url) => url.includes('order_by=-period'));

  await load(options, signal());

  expect(probes()).toHaveLength(2);

  await load({ ...options, from: '2026-10-15' }, signal());

  expect(probes()).toHaveLength(2);

  await load(options, signal());

  expect(probes()).toHaveLength(2);

  await load({ ...options, account: 'A-OTHER' }, signal());

  expect(probes()).toHaveLength(4);

  await load({ ...options, key: 'other-key', account: 'A-OTHER' }, signal());

  expect(probes()).toHaveLength(6);

  load.clear();
  await load(options, signal());

  expect(probes()).toHaveLength(8);

  await createDatasetLoader()(options, signal());

  expect(probes()).toHaveLength(10);
});

it('propagates cancellation of an optional dependency instead of returning partial data', async () => {
  setup({ joinedEvents: [happyHour] });

  const controller = new AbortController();
  const ordinaryFetch = vi.mocked(fetch).getMockImplementation()!;

  vi.mocked(fetch).mockImplementation(async (input, init) => {
    if (String(input).includes('gov.uk')) {
      controller.abort();

      throw new DOMException('Cancelled', 'AbortError');
    }

    return ordinaryFetch(input, init);
  });

  await expect(loadDataset(options, controller.signal)).rejects.toThrow('Cancelled');
});

it('the production App reuses discovery when results are refreshed', async () => {
  const calls = setup({ meters: 2 });

  localStorage.setItem('session-lens.api-key', 'test-key');
  localStorage.setItem('session-lens.account-number', 'A-123');
  render(createElement(App));

  const user = userEvent.setup();
  const refresh = await screen.findByRole('button', { name: 'Refresh results' });

  await waitFor(() => expect(refresh).toBeEnabled());

  const probes = () => calls.filter((url) => url.includes('order_by=-period'));

  expect(probes()).toHaveLength(2);

  await user.click(refresh);
  await waitFor(() => expect(refresh).toBeEnabled());

  expect(calls.filter((url) => url.includes('period_from='))).toHaveLength(2);
  expect(probes()).toHaveLength(2);
});

it('keeps estimates stable when the range starts before the oldest event in a complete calendar', async () => {
  const demo = demoDataset();

  setup({ joinedEvents: demo.sessions, meterReadings: { ABC: demo.imports } });

  const today = todayInLondon();

  const narrow = await loadDataset(
    { ...options, from: today.subtract({ days: 30 }).toString(), to: today.toString() },
    signal(),
  );

  const wide = await loadDataset(
    { ...options, from: '2025-12-01', to: today.toString() },
    signal(),
  );

  expect(wide.baselineIssues).toEqual([]);
  expect(calculateAll(narrow)[0].rewarded).not.toBeNull();
  expect(calculateAll(wide)).toEqual(calculateAll(narrow));
});
