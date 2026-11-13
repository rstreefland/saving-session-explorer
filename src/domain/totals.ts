import { Decimal, type Numeric } from './decimal';
import { estimateOctopoints } from './points';
import { sessionOutcome } from './outcome';
import { isHappyHour, isPublished, reportedShifted } from './session';
import type { Calculation, Session } from './types';

export interface ColumnTotal {
  value: Decimal | null;
  available: string;
  sessions: string;
  provisional: boolean;
}

function sum(values: { value: Decimal | Numeric | null; provisional?: boolean }[]): ColumnTotal {
  let value = new Decimal(0);
  let available = new Decimal(0);
  let provisional = false;
  for (const entry of values) {
    if (entry.value === null) continue;
    value = value.plus(entry.value);
    available = available.plus(1);
    provisional ||= entry.provisional === true;
  }
  return {
    value: available.isZero() ? null : value,
    available: available.toString(),
    sessions: String(values.length),
    provisional,
  };
}

/** Sum only the figures displayed by each column, without repricing session rewards. */
export function sessionTotals(results: Calculation[]) {
  const outcomes = results.map(sessionOutcome);
  return {
    overview: {
      sessions: String(results.length),
      calculatedAchievement: sum(
        results.map((result, index) => ({
          value: outcomes[index].code === 'unavailable' ? null : outcomes[index].achieved ? 1 : 0,
          provisional: result.provisional,
        })),
      ),
      officialAchievement: sum(
        results.map(({ session }) => ({
          value: isPublished(session)
            ? ['SUCCESS', 'PARTIAL_SUCCESS'].includes(session.resultsStatus ?? '')
              ? 1
              : 0
            : null,
        })),
      ),
      missedRewards: String(outcomes.filter((outcome) => outcome.attention).length),
      pending: String(
        results.filter(
          ({ session }) =>
            !isPublished(session) &&
            session.resultsStatus !== 'MISSING_READINGS' &&
            session.resultsStatus !== 'UPCOMING',
        ).length,
      ),
      missing: String(
        results.filter(({ session }) => session.resultsStatus === 'MISSING_READINGS').length,
      ),
      upcoming: String(
        results.filter(({ session }) => session.resultsStatus === 'UPCOMING').length,
      ),
      unavailable: String(outcomes.filter((outcome) => outcome.code === 'unavailable').length),
    },
    energy: sum(results.map((r) => ({ value: r.rewarded, provisional: r.provisional }))),
    officialEnergy: sum(results.map((r) => ({ value: reportedShifted(r.session) }))),
    reward: sum(
      results.map((r) => {
        const estimate = estimateOctopoints(r);
        return {
          value: estimate.state === 'ready' ? estimate.points : null,
          provisional: r.provisional,
        };
      }),
    ),
    officialReward: sum(results.map(({ session }) => ({ value: officialRewardValue(session) }))),
  };
}

export type SessionTotals = ReturnType<typeof sessionTotals>;

/** Keep footer eligibility identical to the reward shown in each history row. */
export function officialRewardValue(session: Session): Numeric | null {
  if (!session.resultsStatus || ['CALCULATING', 'UPCOMING'].includes(session.resultsStatus))
    return null;
  return isHappyHour(session)
    ? (session.rewardGivenInPence ?? null)
    : session.rewardGivenInOctoPoints;
}
