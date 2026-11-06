import { z } from 'zod';
import { AUTH, graphql } from './client';
import { indexReadings } from '../domain/calculate';
import type { Reading } from '../domain/types';

// Configure before constructing schemas: this module loads before client.ts.
z.config({ jitless: true });

const HALF_HOUR = 1_800_000;
const DAY = 86_400_000;
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
  const occupied = new Set(readings.map((r) => Date.parse(r.interval_start)));
  const candidates: Reading[] = telemetrySchema.parse(raw).smartMeterTelemetry.flatMap((row) => {
    const time = Date.parse(row.readAt);
    const value =
      row.consumptionDelta === null || String(row.consumptionDelta).trim() === ''
        ? NaN
        : Number(row.consumptionDelta) / 1000;
    return time >= start &&
      time + HALF_HOUR <= end &&
      time % HALF_HOUR === 0 &&
      Number.isFinite(value) &&
      value >= 0
      ? [
          {
            interval_start: new Date(time).toISOString(),
            interval_end: new Date(time + HALF_HOUR).toISOString(),
            consumption: value,
            source: 'home-mini' as const,
          },
        ]
      : [];
  });
  const indexed = indexReadings(candidates);
  return [
    ...readings,
    ...candidates.filter(
      (r) =>
        !occupied.has(Date.parse(r.interval_start)) &&
        indexed.get(Date.parse(r.interval_start)) != null,
    ),
  ];
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
  const now = options.now ?? Date.now();
  // Stay inside the rolling 30-day retention boundary, including during requests.
  const start =
    Math.ceil(Math.max(Date.parse(options.from), now - 29 * DAY) / HALF_HOUR) * HALF_HOUR;
  const end = Math.floor(Math.min(Date.parse(options.to), now) / HALF_HOUR) * HALF_HOUR;
  let readings = options.readings;
  const occupied = new Set(readings.map((r) => Date.parse(r.interval_start)));
  const windows: [number, number][] = [];
  for (let day = Math.floor(start / DAY) * DAY; day < end; day += DAY) {
    const from = Math.max(start, day),
      to = Math.min(end, day + DAY);
    for (let time = from; time < to; time += HALF_HOUR) {
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
        { device, start: new Date(from).toISOString(), end: new Date(to).toISOString() },
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
