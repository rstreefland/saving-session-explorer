import { precisionFixture } from '../test/precisionFixture';
import type { Reading } from '../domain/types';
import { decimal } from '../domain/decimal';
import { createElement } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { demoDataset } from '../domain/demo';
import { Temporal, iso, midnight, todayInLondon } from '../domain/time';
import { describe, it, expect, vi } from 'vitest';
import { dataWarnings } from '../domain/availability';
import { calculateAll } from '../domain/calculate';
import type { Session } from '../domain/types';
import { fetchReadings, graphql, loadDataset, selectMeter, AUTH, GRAPHQL } from './client';

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
  tokenBalance = 3,
  tokenFailure = false,
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
  meterReadings = {} as Record<string, Reading[]>,
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

        if (query.includes('HomeMiniDevices'))
          return response({ data: { account: { electricityAgreements: [] } } });

        return profileUnavailable
          ? response({ errors: [{ message: 'Profile unavailable' }] })
          : response({ data: { account: { number: 'A-123', billingName: holderName } } });
      }

      if (url === GRAPHQL && String(init.body).includes('HappyHourTokens'))
        return tokenFailure
          ? response({ errors: [{ message: 'Token balance unavailable' }] })
          : response({ data: { savingSessions: { account: { tokenBalance } } } });

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

        next.searchParams.set(
          'page',
          String(
            decimal(next.searchParams.get('page') ?? 1)
              .plus(1)
              .toNumber(),
          ),
        );

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
      actual: decimal(0.2),
      rewarded: decimal(0.2),
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
  expect(calculateAll(data)[0]).toMatchObject({
    actual: decimal(0.2),
    rewarded: decimal(0.2),
    state: 'match',
  });
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

it('refreshes the selected meter when newer half-hour readings arrive on another serial', async () => {
  const meterReadings = {
    ABC: [reading],
    REPLACEMENT: [
      { ...reading, interval_start: '2026-10-31T00:00:00Z', interval_end: '2026-10-31T00:30:00Z' },
    ],
  };
  const calls = setup({ meters: 2, meterReadings });

  localStorage.setItem('session-lens.api-key', 'test-key');
  localStorage.setItem('session-lens.account-number', 'A-123');
  render(createElement(App));

  const user = userEvent.setup();
  const refresh = await screen.findByRole('button', { name: 'Refresh results' });

  await waitFor(() => expect(refresh).toBeEnabled());
  expect(screen.getByText(/Import meter: ABC/)).toBeInTheDocument();

  meterReadings.REPLACEMENT = [
    { ...reading, interval_start: '2026-11-02T00:00:00Z', interval_end: '2026-11-02T00:30:00Z' },
  ];
  await user.click(refresh);

  await waitFor(() => expect(screen.getByText(/Import meter: REPLACEMENT/)).toBeInTheDocument());
  const historyCalls = calls.filter((url) => url.includes('period_from='));

  expect(historyCalls).toHaveLength(2);
  expect(historyCalls[0]).toContain('/meters/ABC/');
  expect(historyCalls[1]).toContain('/meters/REPLACEMENT/');
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

it.each(['TURN_DOWN', 'TURN_UP'] as const)(
  'loads and displays an upcoming %s baseline for a connected account',
  async (eventType) => {
    vi.spyOn(Temporal.Now, 'instant').mockReturnValue(
      Temporal.Instant.from('2026-11-01T17:00:00Z'),
    );
    try {
      const base: Session = {
        ...demoDataset().sessions[0],
        eventType,
        resultsStatus: 'UPCOMING',
      };
      const joinedEvents = [
        ['2026-11-01T15:00:00Z', '2026-11-01T16:00:00Z'],
        ['2026-11-01T16:30:00Z', '2026-11-01T17:30:00Z'],
        ['2026-11-01T18:00:00Z', '2026-11-01T19:00:00Z'],
        ['2026-11-02T18:00:00Z', '2026-11-02T19:00:00Z'],
        ['2026-11-03T18:00:00Z', '2026-11-03T19:00:00Z'],
      ].map(([startAt, endAt], index) => ({
        ...base,
        eventId: decimal(10).plus(index).toNumber(),
        startAt,
        endAt,
      }));
      const referenceDates = [
        '2026-10-30',
        '2026-10-29',
        '2026-10-28',
        '2026-10-27',
        '2026-10-26',
        '2026-10-23',
        '2026-10-22',
        '2026-10-21',
        '2026-10-20',
        '2026-10-19',
      ];
      const history = referenceDates.flatMap((date) =>
        [0, 30].map((minute) => {
          const start = midnight(date).with({ hour: 18, minute });
          return {
            interval_start: iso(start),
            interval_end: iso(start.add({ minutes: 30 })),
            consumption: 0.6,
          };
        }),
      );
      setup({ joinedEvents, meterReadings: { ABC: history } });
      const data = await loadDataset(
        { ...options, from: '2026-11-01', to: '2026-11-02' },
        signal(),
      );
      expect(data.sessions.map((s) => s.eventId)).toEqual([10, 11, 12, 13]);
      const upcoming = calculateAll(data).find((r) => r.session.eventId === 13)!;
      expect(upcoming.baseline?.toNumber()).toBeCloseTo(1.2);
      expect(upcoming.actual).toBeNull();
      expect(upcoming.rewarded).toBeNull();
      expect(upcoming.issues).toEqual(['2 session half-hour reading(s) missing or invalid.']);

      // Exercise the normal App and real loader, with only network responses mocked.
      localStorage.setItem('session-lens.api-key', 'test-key');
      localStorage.setItem('session-lens.account-number', 'A-123');
      render(createElement(App));
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Custom dates' }));
      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-01' } });
      expect(screen.getByLabelText('To')).not.toHaveAttribute('max');
      fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-11-02' } });
      await user.click(screen.getByRole('button', { name: 'Apply dates' }));
      if (eventType === 'TURN_UP') await user.click(screen.getByRole('tab', { name: 'Power up' }));
      const toggle = await screen.findByRole('button', {
        name: /Readings for Power (down|up) 2 Nov 2026/,
      });
      const row = toggle.closest('tr')!;
      const indicator = within(row).getByRole('button', { name: 'Session has not ended yet' });
      await user.click(indicator);
      expect(screen.getByRole('tooltip')).toHaveTextContent('You can inspect your baseline');
      await user.click(toggle);
      const summary = screen.getByRole('region', { name: 'Calculation summary' });
      expect(within(summary).getAllByText('0.600')).toHaveLength(2);
      expect(screen.getByText('2 session half-hour reading(s) missing or invalid.')).toBeVisible();
      expect(summary).toHaveTextContent('This estimate is incomplete.');
    } finally {
      vi.useRealTimers();
    }
  },
);

it.each([false, true])(
  'renders exact reference means via the default App/API path (%s)',
  async (uniform) => {
    vi.spyOn(Temporal.Now, 'instant').mockReturnValue(
      Temporal.Instant.from('2026-11-06T12:00:00Z'),
    );
    vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(Temporal.PlainDate.from('2026-11-06'));
    const data = precisionFixture(uniform);
    setup({ joinedEvents: data.sessions, meterReadings: { ABC: data.imports }, rewardRate: '80' });
    localStorage.setItem('session-lens.api-key', 'synthetic-key');
    localStorage.setItem('session-lens.account-number', 'A-123');
    render(createElement(App));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Readings for/ }));
    const summary = screen.getByRole('region', { name: 'Calculation summary' });
    expect(summary).toHaveTextContent('Baseline0.101 kWh');
    expect(summary).toHaveTextContent('Total shifted for rewards0.101 kWh');
    await user.click(screen.getByText('Days used for baseline (10)', { exact: true }));
    const references = screen.getByRole('table', { name: 'Readings used for baseline' });
    expect(
      within(references).getByRole('row', { name: 'Average for this half-hour 0.101' }),
    ).toBeVisible();
    expect(screen.getByRole('region', { name: 'Octopoints estimate' })).toHaveTextContent(
      '0.1005 kWh × 80 points/kWh = 8.04 points.',
    );
    expect(screen.getByRole('region', { name: 'Octopoints estimate' })).toHaveTextContent(
      '0 Octopoints. Matches Octopus.',
    );
  },
);

it.each([0, 1, 1234])(
  'shows an account-wide Happy Hours balance of %s through the normal App',
  async (tokenBalance) => {
    setup({ tokenBalance });
    localStorage.setItem('session-lens.api-key', 'test-key');
    localStorage.setItem('session-lens.account-number', 'A-123');
    render(createElement(App));

    const tab = await screen.findByRole('tab', { name: 'Happy Hours' });
    expect(
      within(tab).getByText(tokenBalance === 1234 ? '1,234' : String(tokenBalance)),
    ).toBeInTheDocument();
    expect(tab).toHaveAccessibleDescription(
      `${tokenBalance === 1234 ? '1,234' : String(tokenBalance)} Happy Hours ${tokenBalance === 1 ? 'token' : 'tokens'} available. Account balance, independent of the selected dates.`,
    );
    await userEvent.click(tab);
    expect(screen.getByRole('table', { name: 'Happy Hours session history' })).toBeInTheDocument();
    expect(tab).toHaveTextContent(
      tokenBalance === 1
        ? '1 token'
        : `${tokenBalance === 1234 ? '1,234' : String(tokenBalance)} tokens`,
    );
  },
);

it('keeps session results usable when loading tokens fails', async () => {
  setup({ tokenFailure: true, joinedEvents: demoDataset().sessions });
  localStorage.setItem('session-lens.api-key', 'test-key');
  localStorage.setItem('session-lens.account-number', 'A-123');
  render(createElement(App));

  expect(await screen.findByRole('tab', { name: 'Happy Hours' })).toHaveAccessibleDescription(
    'Happy Hours token balance unavailable. Refresh results to try again.',
  );
  expect(screen.getByRole('table', { name: 'Power down session history' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Happy Hours' })).toHaveTextContent('••• tokens');
});

it('propagates cancellation while the optional token balance is loading', async () => {
  setup();
  const controller = new AbortController();
  const ordinaryFetch = vi.mocked(fetch).getMockImplementation();
  if (!ordinaryFetch) throw new Error('Expected fetch fixture');
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    if (String(init?.body).includes('HappyHourTokens')) {
      controller.abort();
      throw new DOMException('Cancelled', 'AbortError');
    }
    return ordinaryFetch(input, init);
  });

  await expect(loadDataset(options, controller.signal)).rejects.toThrow('Cancelled');
});
