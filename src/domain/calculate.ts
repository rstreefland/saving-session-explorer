import { Temporal, local, day, milliseconds, iso, referenceTime } from './time';
import { BASELINE_ISSUES } from './availability';
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

function isSupportedSession(session: Session): boolean {
  const start = local(session.startAt);
  const end = local(session.endAt);
  const duration = end.epochMilliseconds - start.epochMilliseconds;

  return (
    ['TURN_DOWN', 'TURN_UP', 'WEEKEND_HAPPY_HOUR'].includes(session.eventType) &&
    day(session.startAt) === end.subtract({ milliseconds: 1 }).toPlainDate().toString() &&
    start.epochMilliseconds % 1_800_000 === 0 &&
    end.epochMilliseconds % 1_800_000 === 0 &&
    duration > 0 &&
    duration <= 86_400_000 &&
    start.toPlainDate().toString() >= '2024-11-29'
  );
}

/** Null means at least one required reading is missing; zero is a valid total. */
function total(values: (number | null)[]): number | null {
  if (values.length === 0) return null;

  let sum = 0;

  for (const value of values) {
    if (value === null) return null;

    sum += value;
  }

  return sum;
}

function comparisonState(
  session: Session,
  reason: Calculation['unavailableReason'],
  difference: number | null,
  baseline: number | null,
  actual: number | null,
): Calculation['state'] {
  if (reason === 'unsupported') return 'unsupported';
  if (reason !== null) return 'incomplete';
  if (difference === null) return 'pending';

  const deltas = [difference];

  if (!isHappyHour(session)) {
    if (baseline !== null && session.baselineConsumptionDeltaKwh !== null)
      deltas.push(baseline - session.baselineConsumptionDeltaKwh);

    if (actual !== null && session.consumptionDeltaKwh !== null)
      deltas.push(actual - session.consumptionDeltaKwh);
  }

  return deltas.some((delta) => Math.abs(delta) > TOLERANCE + 1e-9) ? 'difference' : 'match';
}

export function calculateAll(data: Dataset): Calculation[] {
  const miniTimes = new Set(
    data.imports.filter((r) => r.source === 'home-mini').map((r) => milliseconds(r.interval_start)),
  );
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

    const blockers = happyHour ? [] : data.baselineIssues;
    const issues = blockers.map((issue) => BASELINE_ISSUES[issue]);
    const unsupported = !isSupportedSession(session);

    if (unsupported)
      issues.push('This event type, date or interval is outside the supported methodology.');

    const slots: Calculation['slots'] = [];
    let ambiguousClockTime = false;
    let provisional = false;

    if (!unsupported)
      for (
        let time = start;
        time.epochMilliseconds < end.epochMilliseconds;
        time = time.add({ minutes: 30 })
      ) {
        if (miniTimes.has(time.epochMilliseconds)) provisional = true;
        const references = days.map((date) => {
          const target = referenceTime(date, time.toPlainTime());

          const unambiguous =
            referenceTime(time.toPlainDate().toString(), time.toPlainTime()) !== null;

          if (target === null || !unambiguous) ambiguousClockTime = true;

          if (target !== null && unambiguous && miniTimes.has(target)) provisional = true;

          return { date, value: target !== null && unambiguous ? read(target) : null };
        });

        const complete =
          references.length === referenceCount && references.every((r) => r.value !== null);

        slots.push({
          start: iso(time),
          actualProvisional: miniTimes.has(time.epochMilliseconds),
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

    const baseline = total(slots.map((slot) => slot.baseline));
    const actual = total(slots.map((slot) => slot.actual));
    let unavailableReason: Calculation['unavailableReason'] = null;

    if (unsupported) unavailableReason = 'unsupported';
    else if (blockers.length) unavailableReason = blockers[0];
    else if (missingActual > 0) unavailableReason = 'session-readings';
    else if (ambiguousClockTime) unavailableReason = 'clock-change';
    else if (missingReference > 0) unavailableReason = 'baseline-readings';
    else if (!happyHour && days.length < referenceCount) unavailableReason = 'baseline-history';

    const complete = unavailableReason === null;
    let rewarded: number | null = null;

    if (complete) {
      if (happyHour) rewarded = actual;
      else {
        const direction = session.eventType === 'TURN_UP' ? -1 : 1;

        rewarded = slots.reduce(
          (sum, slot) => sum + Math.max(0, (slot.baseline! - slot.actual!) * direction),
          0,
        );
      }
    }

    const reported = reportedShifted(session);
    const difference = rewarded !== null && reported !== null ? rewarded - reported : null;

    return {
      session,
      provisional,
      slots,
      days,
      issues,
      baseline,
      actual,
      rewarded,
      netSaved: complete && !happyHour ? baseline! - actual! : null,
      difference,
      unavailableReason,
      state: comparisonState(session, unavailableReason, difference, baseline, actual),
    };
  });
}
