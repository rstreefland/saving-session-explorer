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
} as const;

type PointsEstimate =
  | { state: 'unavailable'; reason: keyof typeof POINTS_UNAVAILABLE }
  | {
      state: 'ready';
      shifted: number;
      rate: number;
      raw: number;
      pennyRounded: number;
      points: number;
      actual: number | null;
      difference: number | null;
    };

/** A pending API zero is a placeholder, not an award. Null is always unknown. */
export function actualOctopoints(session: Session): number | null {
  const value = session.rewardGivenInOctoPoints;
  return (isPublished(session) || session.resultsStatus === 'MISSING_READINGS') &&
    value !== null &&
    Number.isFinite(value) &&
    value >= 0
    ? value
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
  if (result.state === 'incomplete' || shifted === null || !Number.isFinite(shifted) || shifted < 0)
    return { state: 'unavailable', reason: 'readings' };
  const rate = session.rewardPerKwhInOctoPoints;
  if (rate == null || !Number.isFinite(rate) || rate < 0)
    return { state: 'unavailable', reason: 'rate' };
  // Averaging identical readings can leave a tiny positive remainder. It must not
  // trigger the assumed minimum reward when there was no real energy reduction.
  const energyScale = Math.max(1, Math.abs(result.baseline ?? 0), Math.abs(result.actual ?? 0));
  const raw = shifted <= Number.EPSILON * energyScale * 8 ? 0 : shifted * rate;
  if (!Number.isFinite(raw) || raw > Number.MAX_SAFE_INTEGER - POINTS_PER_PENNY)
    return { state: 'unavailable', reason: 'rate' };
  const pennies = raw / POINTS_PER_PENNY;
  const nearest = Math.round(pennies);
  // Multiplication and summation can put an exact penny a few ULPs above its boundary.
  const atBoundary = Math.abs(pennies - nearest) <= Number.EPSILON * Math.max(1, pennies) * 8;
  const pennyRounded = (atBoundary ? nearest : Math.ceil(pennies)) * POINTS_PER_PENNY;
  const points = raw > 0 ? Math.max(ASSUMED_MINIMUM_POINTS, pennyRounded) : 0;
  const actual = actualOctopoints(session);
  return {
    state: 'ready',
    shifted,
    rate,
    raw,
    pennyRounded,
    points,
    actual,
    difference: actual === null ? null : points - actual,
  };
}
