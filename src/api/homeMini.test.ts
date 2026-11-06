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
  it('does not call telemetry for old history or complete standard coverage', async () => {
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
