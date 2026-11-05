import type { Calculation } from './types';
import { isHappyHour } from './session';

export interface SessionOutcome {
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
      'event-history': 'Awaiting session history',
      'clock-change': 'Clock change: check readings',
      unsupported: 'Not supported',
    };
    return {
      label: unavailableReason ? labels[unavailableReason] : 'Not enough data',
      achieved: false,
      attention: false,
      tone: 'waiting',
    };
  }
  if (isHappyHour(session))
    return { label: 'Usage recorded', achieved: false, attention: false, tone: 'neutral' };

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
  return {
    label: achieved ? (achievedOverall ? 'Achieved' : 'Partly achieved') : 'Not achieved',
    achieved,
    attention,
    tone: achieved ? 'positive' : 'negative',
  };
}
