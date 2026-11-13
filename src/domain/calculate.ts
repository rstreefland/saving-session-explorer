import { decimal, Decimal, positive, total } from './decimal';
import {
  Temporal,
  local,
  day,
  milliseconds,
  iso,
  referenceTime,
  alignedHalfHour,
  elapsedHalfHour,
} from './time';
import { BASELINE_ISSUES } from './availability';
import { isHappyHour, reportedShifted } from './session';
import type { Calculation, Dataset, Reading, Session } from './types';

export { ZONE, local, day } from './time';

const validConsumption = (value: number | string) =>
  (typeof value === 'string' || Number.isFinite(value)) && decimal(value).gte(0);

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

  for (
    let offset = 1;
    offset <= 60 && days.length < count;
    offset = decimal(offset).plus(1).toNumber()
  ) {
    const date = start.subtract({ days: offset });
    const key = date.toString();

    if (weekend(date) === useWeekend && !excluded.has(key) && !holidays.has(key)) days.push(key);
  }

  return days;
}

/** Index UTC intervals; duplicate/conflicting and non-half-hour values are unusable. */
export function indexReadings(readings: Reading[]) {
  const result = new Map<number, Decimal | null>();

  for (const r of readings) {
    const start = milliseconds(r.interval_start);

    const valid =
      validConsumption(r.consumption) &&
      elapsedHalfHour(r.interval_start, r.interval_end) &&
      alignedHalfHour(r.interval_start);

    result.set(start, result.has(start) || !valid ? null : decimal(r.consumption));
  }

  return result;
}

function isSupportedSession(session: Session): boolean {
  const start = local(session.startAt);
  const end = local(session.endAt);
  const duration = start.until(end, { largestUnit: 'hours' }).total('milliseconds');

  return (
    ['TURN_DOWN', 'TURN_UP', 'WEEKEND_HAPPY_HOUR'].includes(session.eventType) &&
    day(session.startAt) === end.subtract({ milliseconds: 1 }).toPlainDate().toString() &&
    alignedHalfHour(session.startAt) &&
    alignedHalfHour(session.endAt) &&
    duration > 0 &&
    duration <= 86_400_000 &&
    start.toPlainDate().toString() >= '2024-11-29'
  );
}

function comparisonState(
  session: Session,
  reason: Calculation['unavailableReason'],
  difference: Decimal | null,
  baseline: Decimal | null,
  actual: Decimal | null,
): Calculation['state'] {
  if (reason === 'unsupported') return 'unsupported';
  if (reason !== null) return 'incomplete';
  if (difference === null) return 'pending';

  const deltas = [difference];

  if (!isHappyHour(session)) {
    if (baseline !== null && session.baselineConsumptionDeltaKwh !== null)
      deltas.push(baseline.minus(session.baselineConsumptionDeltaKwh));

    if (actual !== null && session.consumptionDeltaKwh !== null)
      deltas.push(actual.minus(session.consumptionDeltaKwh));
  }

  return deltas.some((delta) => delta.abs().gt(TOLERANCE)) ? 'difference' : 'match';
}

export function calculateAll(data: Dataset): Calculation[] {
  const miniTimes = new Set(
    data.imports.filter((r) => r.source === 'home-mini').map((r) => milliseconds(r.interval_start)),
  );
  const imports = indexReadings(data.imports);
  const exports = data.exports === null ? null : indexReadings(data.exports);

  const read = (time: number): Decimal | null => {
    const i = imports.get(time);
    const e = exports === null ? decimal(0) : exports.get(time);

    return i == null || e == null ? null : i.minus(e);
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
            ? (total(references.map((r) => r.value))?.div(references.length) ?? null)
            : null,
          references,
        });
      }

    if (!happyHour && days.length < referenceCount)
      issues.push('Not enough eligible reference days within 60 days.');

    const missingActual = slots.filter((s) => s.actual === null).length;

    const missingReference = slots.reduce(
      (sum, s) => sum.plus(s.references.filter((r) => r.value === null).length),
      decimal(0),
    );

    if (missingActual)
      issues.push(`${missingActual} session half-hour reading(s) missing or invalid.`);

    if (!missingReference.isZero())
      issues.push(
        `${missingReference} baseline half-hour reading(s) missing, invalid or ambiguous at a clock change.`,
      );

    const baseline = total(slots.map((slot) => slot.baseline));
    const actual = total(slots.map((slot) => slot.actual));
    let unavailableReason: Calculation['unavailableReason'] = null;

    if (unsupported) unavailableReason = 'unsupported';
    else if (blockers.length) unavailableReason = blockers[0] ?? null;
    else if (missingActual > 0) unavailableReason = 'session-readings';
    else if (ambiguousClockTime) unavailableReason = 'clock-change';
    else if (missingReference.gt(0)) unavailableReason = 'baseline-readings';
    else if (!happyHour && days.length < referenceCount) unavailableReason = 'baseline-history';

    const complete = unavailableReason === null;
    let rewarded: Decimal | null = null;

    if (complete) {
      if (happyHour) rewarded = actual;
      else {
        const direction = session.eventType === 'TURN_UP' ? -1 : 1;

        rewarded = slots.reduce(
          (sum, slot) =>
            slot.baseline === null || slot.actual === null
              ? sum
              : sum.plus(positive(slot.baseline.minus(slot.actual).times(direction))),
          decimal(0),
        );
      }
    }

    const reported = reportedShifted(session);
    const difference = rewarded !== null && reported !== null ? rewarded.minus(reported) : null;

    return {
      session,
      provisional,
      slots,
      days,
      issues,
      baseline,
      actual,
      rewarded,
      netSaved:
        complete && !happyHour && baseline !== null && actual !== null
          ? baseline.minus(actual)
          : null,
      difference,
      unavailableReason,
      state: comparisonState(session, unavailableReason, difference, baseline, actual),
    };
  });
}
