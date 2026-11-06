import { describe, expect, it, vi, afterEach } from 'vitest';
import { fillHomeMiniGaps, mergeHomeMini } from './homeMini';
const start = Date.parse('2026-11-05T00:00:00Z');
const end = start + 3_600_000;
const row = (readAt: number, consumptionDelta: unknown) => ({
  readAt: new Date(readAt).toISOString(),
  consumptionDelta,
});
const raw = (...rows: ReturnType<typeof row>[]) => ({ smartMeterTelemetry: rows });
afterEach(() => vi.unstubAllGlobals());
describe('Home Mini fallback', () => {
  it('uses Wh deltas, preserves zero and excludes null, malformed, negative and unfinished intervals', () => {
    const readings = mergeHomeMini(
      [],
      raw(row(start, '125.000'), row(start + 1_800_000, 0), row(end, '50')),
      start,
      end,
    );
    expect(readings.map((r) => r.consumption)).toEqual([0.125, 0]);
    expect(readings.every((r) => r.source === 'home-mini')).toBe(true);
    for (const value of [null, '', 'oops', '-1'])
      expect(mergeHomeMini([], raw(row(start, value)), start, end)).toEqual([]);
    expect(mergeHomeMini([], raw(row(start + 1, '10')), start, end)).toEqual([]);
  });
  it('never overwrites standard rows or accepts duplicate telemetry', () => {
    const standard = [
      {
        interval_start: new Date(start).toISOString(),
        interval_end: new Date(start + 1_800_000).toISOString(),
        consumption: 0.2,
      },
    ];
    expect(mergeHomeMini(standard, raw(row(start, '125')), start, end)).toEqual(standard);
    expect(mergeHomeMini([], raw(row(start, '125'), row(start, '125')), start, end)).toEqual([]);
  });
  it('matches device to MPAN and serial, queries daily and retains successful days on failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            account: {
              electricityAgreements: [
                {
                  meterPoint: {
                    mpan: 'wrong',
                    meters: [
                      {
                        serialNumber: 'SERIAL',
                        smartImportElectricityMeter: { deviceId: 'wrong' },
                      },
                    ],
                  },
                },
                {
                  meterPoint: {
                    mpan: 'MPAN',
                    meters: [
                      {
                        serialNumber: 'SERIAL',
                        smartImportElectricityMeter: { deviceId: 'right' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: raw(row(start + 86_400_000, '125')) }),
      })
      .mockResolvedValueOnce({ ok: false, status: 429 });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fillHomeMiniGaps({
      account: 'A',
      token: 'token',
      mpan: 'MPAN',
      serial: 'SERIAL',
      from: new Date(start).toISOString(),
      to: new Date(start + 2 * 86_400_000).toISOString(),
      now: start + 2 * 86_400_000,
      readings: [],
      signal: new AbortController().signal,
    });
    expect(result.unavailable).toBe(true);
    expect(result.readings.map((r) => r.consumption)).toEqual([0.125]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).variables).toEqual({
      device: 'right',
      start: new Date(start + 86_400_000).toISOString(),
      end: new Date(start + 2 * 86_400_000).toISOString(),
    });
  });
  it('does not call telemetry for history outside retention', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await fillHomeMiniGaps({
      account: 'A',
      token: 't',
      mpan: 'M',
      serial: 'S',
      from: new Date(start).toISOString(),
      to: new Date(end).toISOString(),
      now: end + 31 * 86_400_000,
      readings: [],
      signal: new AbortController().signal,
    });
    expect(f).not.toHaveBeenCalled();
  });
  it('propagates cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));
    await expect(
      fillHomeMiniGaps({
        account: 'A',
        token: 't',
        mpan: 'M',
        serial: 'S',
        from: new Date(start).toISOString(),
        to: new Date(end).toISOString(),
        now: end,
        readings: [],
        signal: controller.signal,
      }),
    ).rejects.toThrow('Aborted');
  });
});

it.each([null, '', 'oops', '-1'])(
  'rejects a valid row duplicated by invalid telemetry (%s), in either order',
  (value) => {
    const valid = row(start, '125');
    const invalid = { ...row(start, value), readAt: '2026-11-05T01:00:00+01:00' };
    for (const rows of [
      [valid, invalid],
      [invalid, valid],
    ])
      expect(mergeHomeMini([], raw(...rows), start, end)).toEqual([]);
  },
);

const options = () => ({
  account: 'A',
  token: 't',
  mpan: 'MPAN',
  serial: 'SERIAL',
  from: new Date(start).toISOString(),
  to: new Date(end).toISOString(),
  now: end,
  readings: [],
  signal: new AbortController().signal,
});
const meter = (serialNumber: string, deviceId: string | null) => ({
  serialNumber,
  smartImportElectricityMeter: deviceId === null ? null : { deviceId },
});
const discovery = (points: unknown[]) => ({
  ok: true,
  json: async () => ({
    data: { account: { electricityAgreements: points.map((meterPoint) => ({ meterPoint })) } },
  }),
});

it('makes no requests for recent fully covered standard readings', async () => {
  const f = vi.fn();
  vi.stubGlobal('fetch', f);
  const readings = [0, 1].map((i) => ({
    interval_start: new Date(start + i * 1_800_000).toISOString(),
    interval_end: new Date(start + (i + 1) * 1_800_000).toISOString(),
    consumption: 0,
  }));
  expect(await fillHomeMiniGaps({ ...options(), readings })).toEqual({
    readings,
    unavailable: false,
  });
  expect(f).not.toHaveBeenCalled();
});

it('clips retention to completed aligned slots and requests exact UTC windows newest first', async () => {
  const now = Date.parse('2026-11-06T10:17:00Z');
  const oldest = Date.parse('2026-10-08T10:30:00Z');
  const f = vi
    .fn()
    .mockResolvedValueOnce(discovery([{ mpan: 'MPAN', meters: [meter('SERIAL', 'right')] }]))
    .mockImplementation(async (_url, init) => {
      const { start: from, end: to } = JSON.parse(init.body).variables;
      return {
        ok: true,
        json: async () => ({ data: raw(row(Date.parse(from), '125'), row(Date.parse(to), '125')) }),
      };
    });
  vi.stubGlobal('fetch', f);
  const result = await fillHomeMiniGaps({
    ...options(),
    from: '2026-10-01T00:00:00Z',
    to: '2026-11-07T00:00:00Z',
    now,
  });
  const windows = f.mock.calls.slice(1).map((call) => JSON.parse(call[1].body).variables);
  expect(windows).toHaveLength(30);
  expect(windows[0]).toEqual({
    device: 'right',
    start: '2026-11-06T00:00:00.000Z',
    end: '2026-11-06T10:00:00.000Z',
  });
  expect(windows.at(-1)).toEqual({
    device: 'right',
    start: '2026-10-08T10:30:00.000Z',
    end: '2026-10-09T00:00:00.000Z',
  });
  windows.forEach((window, i) => {
    const expectedFrom = Math.max(oldest, Date.parse('2026-11-06T00:00:00Z') - i * 86_400_000);
    const expectedTo = Math.min(
      Math.floor(now / 1_800_000) * 1_800_000,
      Date.parse('2026-11-07T00:00:00Z') - i * 86_400_000,
    );
    expect(Date.parse(window.start)).toBe(expectedFrom);
    expect(Date.parse(window.end)).toBe(expectedTo);
  });
  expect(
    result.readings.every(
      (r) =>
        Date.parse(r.interval_start) >= oldest &&
        Date.parse(r.interval_end) <= Math.floor(now / 1_800_000) * 1_800_000,
    ),
  ).toBe(true);
});

it('ignores wrong serials, null metadata and export meter points during discovery', async () => {
  const f = vi
    .fn()
    .mockResolvedValueOnce(
      discovery([
        {
          mpan: 'MPAN',
          meters: [meter('OLD', 'wrong-serial'), meter('SERIAL', null), meter('SERIAL', 'right')],
        },
        { mpan: 'EXPORT', meters: [meter('SERIAL', 'wrong-export')] },
      ]),
    )
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: raw(row(start, '125')) }) });
  vi.stubGlobal('fetch', f);
  expect((await fillHomeMiniGaps(options())).readings).toHaveLength(1);
  expect(JSON.parse(f.mock.calls[1][1].body).variables.device).toBe('right');
});

it.each([
  [meter('OLD', 'wrong')],
  [meter('SERIAL', null)],
  [meter('SERIAL', 'first'), meter('SERIAL', 'second')],
])('preserves standard data when discovery has no unique matching device', async (...meters) => {
  const f = vi.fn().mockResolvedValue(discovery([{ mpan: 'MPAN', meters }]));
  vi.stubGlobal('fetch', f);
  const readings = [
    {
      interval_start: new Date(start).toISOString(),
      interval_end: new Date(start + 1_800_000).toISOString(),
      consumption: 0.2,
    },
  ];
  expect(await fillHomeMiniGaps({ ...options(), readings })).toEqual({
    readings,
    unavailable: false,
  });
  expect(f).toHaveBeenCalledTimes(1);
});
