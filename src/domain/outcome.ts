import type { Calculation } from './types';
import { isHappyHour } from './session';

export interface SessionOutcome {
  code: 'unavailable' | 'usage-recorded' | 'achieved' | 'partly-achieved' | 'not-achieved';
  label: string;
  achieved: boolean;
  attention: boolean;
  tone: 'positive' | 'negative' | 'neutral' | 'waiting';
}
export function sessionOutcome(result: Calculation): SessionOutcome {
  const { session, rewarded, unavailableReason } = result;
  if (rewarded === null) {
    const labels: Record<NonNullable<Calculation['unavailableReason']>, string> = {
      'session-readings': 'Awaiting meter readings',
      'baseline-readings': 'Awaiting meter readings',
      'baseline-history': 'Not enough history',
      holidays: 'Awaiting bank holiday data',
      exports: 'Awaiting export readings',
      'event-history': 'Awaiting session history',
      'clock-change': 'Clock change: check readings',
      unsupported: 'Not supported',
    };
    return {
      code: 'unavailable',
      label: unavailableReason ? labels[unavailableReason] : 'Not enough data',
      achieved: false,
      attention: false,
      tone: 'waiting',
    };
  }
  if (isHappyHour(session))
    return {
      code: 'usage-recorded',
      label: 'Usage recorded',
      achieved: false,
      attention: false,
      tone: 'neutral',
    };

  const achieved = rewarded > 1e-9;
  const officialReward = session.rewardGivenInOctoPoints;
  // Pending results and awarded sessions must never look like disputes over small kWh differences.
  const attention =
    achieved &&
    ((session.resultsStatus === 'FAIL' && (officialReward === 0 || officialReward === null)) ||
      (session.resultsStatus === 'MISSING_READINGS' && officialReward === 0));
  const direction = session.eventType === 'TURN_UP' ? -1 : 1;
  // Overall success concerns the net change across the whole window. Individual
  // half-hours can miss their target while the session still succeeds overall.
  // Rewarded energy remains the sum of positive half-hour shifts, not this net change.
  const achievedOverall = result.netSaved !== null && result.netSaved * direction > 1e-9;
  const code = achieved ? (achievedOverall ? 'achieved' : 'partly-achieved') : 'not-achieved';
  const labels = {
    achieved: 'Achieved',
    'partly-achieved': 'Partly achieved',
    'not-achieved': 'Not achieved',
  };
  return {
    code,
    label: labels[code],
    achieved,
    attention,
    tone: achieved ? 'positive' : 'negative',
  };
}
