import { decimal, Decimal } from './decimal';
import type { Calculation, Session } from './types';
import { isPublished } from './session';

export const POINTS_PER_PENNY = 8;
export const ASSUMED_MINIMUM_POINTS = 16;

export const POINTS_UNAVAILABLE = {
  readings: 'A complete energy estimate is needed first.',
  rate: 'Octopus has not supplied a usable points-per-kWh rate for this session.',
  tariff:
    'Power up rewards need your import tariff rates, which are not included in this estimate.',
  cash: 'Happy Hours pay bill credit rather than Octopoints.',
  unsupported: 'This session cannot be estimated.',
} satisfies Record<string, string>;

type PointsEstimate =
  | { state: 'unavailable'; reason: keyof typeof POINTS_UNAVAILABLE }
  | {
      state: 'ready';
      shifted: Decimal;
      rate: Decimal;
      raw: Decimal;
      pennyRounded: Decimal;
      points: Decimal;
      actual: Decimal | null;
      difference: Decimal | null;
    };

/** A pending API zero is a placeholder, not an award. Null is always unknown. */
export function actualOctopoints(session: Session): Decimal | null {
  const value = session.rewardGivenInOctoPoints;

  return (isPublished(session) || session.resultsStatus === 'MISSING_READINGS') &&
    value !== null &&
    (typeof value === 'string' || Number.isFinite(value)) &&
    decimal(value).gte(0)
    ? decimal(value)
    : null;
}

/** Empirical Power down model. Rounding/minimum are assumptions, not supplier policy. */
export function estimateOctopoints(result: Calculation): PointsEstimate {
  const { session, rewarded: shifted } = result;

  if (session.eventType === 'WEEKEND_HAPPY_HOUR') return { state: 'unavailable', reason: 'cash' };
  // The API's Power up event rate can be a zero placeholder; tariff prices are required.
  if (session.eventType === 'TURN_UP') return { state: 'unavailable', reason: 'tariff' };

  if (session.eventType !== 'TURN_DOWN' || result.state === 'unsupported')
    return { state: 'unavailable', reason: 'unsupported' };

  if (result.state === 'incomplete' || shifted === null || shifted.isNegative())
    return { state: 'unavailable', reason: 'readings' };

  const suppliedRate = session.rewardPerKwhInOctoPoints;

  if (
    suppliedRate == null ||
    (typeof suppliedRate === 'number' && !Number.isFinite(suppliedRate)) ||
    decimal(suppliedRate).lt(0)
  )
    return { state: 'unavailable', reason: 'rate' };

  const rate = decimal(suppliedRate);
  const raw = shifted.times(rate);
  // Preserve the existing supported reward range, independently of Decimal's range.
  if (raw.gt(decimal(Number.MAX_SAFE_INTEGER).minus(POINTS_PER_PENNY)))
    return { state: 'unavailable', reason: 'rate' };
  const pennyRounded = raw
    .div(POINTS_PER_PENNY)
    .toDecimalPlaces(0, Decimal.ROUND_CEIL)
    .times(POINTS_PER_PENNY);
  const points = raw.gt(0)
    ? pennyRounded.lt(ASSUMED_MINIMUM_POINTS)
      ? decimal(ASSUMED_MINIMUM_POINTS)
      : pennyRounded
    : decimal(0);
  const actual = actualOctopoints(session);

  return {
    state: 'ready',
    shifted,
    rate,
    raw,
    pennyRounded,
    points,
    actual,
    difference: actual === null ? null : points.minus(actual),
  };
}
