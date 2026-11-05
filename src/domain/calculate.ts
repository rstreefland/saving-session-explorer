import { Temporal, local, day, milliseconds, iso, referenceTime } from './time';
import { isHappyHour, reportedShifted } from './session';
import type { Calculation, Dataset, Reading, Session } from './types';
export { ZONE, local, day } from './time';
export const TOLERANCE = 0.01;
const weekend = (d: Temporal.PlainDate | Temporal.ZonedDateTime) => d.dayOfWeek > 5;
const weekendBaseline = (date: Temporal.PlainDate, holidays: Set<string>) =>
  weekend(date) || holidays.has(date.toString());

/** Select dates before inspecting readings: gaps must not silently change the baseline. */
export function referenceDays(session: Session, excluded: Set<string>, holidays: Set<string>) {
  const start = local(session.startAt).toPlainDate();
  const useWeekend = weekendBaseline(start, holidays);
  const count = useWeekend ? 4 : 10;
  const days: string[] = [];
  for (let offset = 1; offset <= 60 && days.length < count; offset++) {
    const date = start.subtract({ days: offset });
    const key = date.toString();
    if (weekend(date) === useWeekend && !excluded.has(key) && !holidays.has(key)) days.push(key);
  }
  return days;
}

/** Index UTC intervals; duplicate/conflicting and non-half-hour values are unusable. */
export function indexReadings(readings: Reading[]) {
  const result = new Map<number, number | null>();
  for (const r of readings) {
    const start = milliseconds(r.interval_start);
    const valid =
      Number.isFinite(r.consumption) &&
      r.consumption >= 0 &&
      milliseconds(r.interval_end) - start === 1_800_000 &&
      start % 1_800_000 === 0;
    result.set(start, result.has(start) || !valid ? null : r.consumption);
  }
  return result;
}

export function calculateAll(data: Dataset): Calculation[] {
  const imports = indexReadings(data.imports);
  const exports = data.exports === null ? null : indexReadings(data.exports);
  const read = (time: number): number | null => {
    const i = imports.get(time);
    const e = exports === null ? 0 : exports.get(time);
    return i == null || e == null ? null : i - e;
  };
  const excluded = new Set(data.eventDays),
    holidays = new Set(data.holidays);
  return data.sessions.map((session) => {
    const start = local(session.startAt),
      end = local(session.endAt);
    const happyHour = isHappyHour(session);
    const referenceCount = weekendBaseline(start.toPlainDate(), holidays) ? 4 : 10;
    const days = happyHour ? [] : referenceDays(session, excluded, holidays);
    const issues: string[] = happyHour ? [] : [...data.warnings];
    const unsupported =
      !['TURN_DOWN', 'TURN_UP', 'WEEKEND_HAPPY_HOUR'].includes(session.eventType) ||
      day(session.startAt) !== end.subtract({ milliseconds: 1 }).toPlainDate().toString() ||
      start.epochMilliseconds % 1_800_000 !== 0 ||
      end.epochMilliseconds % 1_800_000 !== 0 ||
      end.epochMilliseconds <= start.epochMilliseconds ||
      end.epochMilliseconds - start.epochMilliseconds > 86_400_000 ||
      start.toPlainDate().toString() < '2024-11-29';
    if (unsupported)
      issues.push('This event type, date or interval is outside the supported methodology.');
    const slots: Calculation['slots'] = [];
    let ambiguousClockTime = false;
    if (!unsupported)
      for (
        let time = start;
        time.epochMilliseconds < end.epochMilliseconds;
        time = time.add({ minutes: 30 })
      ) {
        const references = days.map((date) => {
          const target = referenceTime(date, time.toPlainTime());
          const unambiguous =
            referenceTime(time.toPlainDate().toString(), time.toPlainTime()) !== null;
          if (target === null || !unambiguous) ambiguousClockTime = true;
          return { date, value: target !== null && unambiguous ? read(target) : null };
        });
        const complete =
          references.length === referenceCount && references.every((r) => r.value !== null);
        slots.push({
          start: iso(time),
          actual: happyHour
            ? (imports.get(time.epochMilliseconds) ?? null)
            : read(time.epochMilliseconds),
          baseline: complete
            ? references.reduce((s, r) => s + r.value!, 0) / references.length
            : null,
          references,
        });
      }
    if (!happyHour && days.length < referenceCount)
      issues.push('Not enough eligible reference days within 60 days.');
    const missingActual = slots.filter((s) => s.actual === null).length;
    const missingReference = slots.reduce(
      (sum, s) => sum + s.references.filter((r) => r.value === null).length,
      0,
    );
    if (missingActual)
      issues.push(`${missingActual} session half-hour reading(s) missing or invalid.`);
    if (missingReference)
      issues.push(
        `${missingReference} baseline half-hour reading(s) missing, invalid or ambiguous at a clock change.`,
      );
    const baseline =
      slots.length && slots.every((s) => s.baseline !== null)
        ? slots.reduce((n, s) => n + s.baseline!, 0)
        : null;
    const actual =
      slots.length && slots.every((s) => s.actual !== null)
        ? slots.reduce((n, s) => n + s.actual!, 0)
        : null;
    const complete = (happyHour || baseline !== null) && actual !== null && !issues.length;
    const rewarded = complete
      ? happyHour
        ? actual
        : slots.reduce(
            (n, s) =>
              n +
              Math.max(0, (s.baseline! - s.actual!) * (session.eventType === 'TURN_UP' ? -1 : 1)),
            0,
          )
      : null;
    const reported = reportedShifted(session);
    const difference = rewarded !== null && reported !== null ? rewarded - reported : null;
    return {
      session,
      slots,
      days,
      issues,
      baseline,
      actual,
      rewarded,
      netSaved: complete && !happyHour ? baseline! - actual! : null,
      difference,
      unavailableReason: unsupported
        ? 'unsupported'
        : missingActual > 0
          ? 'session-readings'
          : ambiguousClockTime
            ? 'clock-change'
            : missingReference > 0
              ? 'baseline-readings'
              : !happyHour && days.length < referenceCount
                ? 'baseline-history'
                : issues.length
                  ? 'event-history'
                  : null,
      state: unsupported
        ? 'unsupported'
        : !complete
          ? 'incomplete'
          : difference === null
            ? 'pending'
            : [
                  difference,
                  happyHour || session.baselineConsumptionDeltaKwh === null
                    ? 0
                    : baseline! - session.baselineConsumptionDeltaKwh,
                  happyHour || session.consumptionDeltaKwh === null
                    ? 0
                    : actual! - session.consumptionDeltaKwh,
                ].some((delta) => Math.abs(delta) > TOLERANCE + 1e-9)
              ? 'difference'
              : 'match',
    };
  });
}
