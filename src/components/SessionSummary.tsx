import type { Calculation } from '../domain/types';
import type { SessionType } from '../domain/session';
import { sessionOutcome } from '../domain/outcome';

const count = (value: number) => String(value);

export function SessionSummary({ results, type }: { results: Calculation[]; type: SessionType }) {
  const happy = type === 'WEEKEND_HAPPY_HOUR';
  const outcomes = results.map(sessionOutcome);
  const estimated = outcomes.filter((outcome) => outcome.achieved).length;
  const actual = results.filter((result) =>
    ['SUCCESS', 'PARTIAL_SUCCESS'].includes(result.session.resultsStatus ?? ''),
  ).length;

  return (
    <section className="stats" aria-label="Session summary">
      <div>
        <span>Sessions</span>
        <strong>{count(results.length)}</strong>
      </div>
      <div>
        <span>
          {happy ? (
            'Usage ready'
          ) : (
            <>
              Achieved or partly achieved<small className="stats-context">Actual / Estimated</small>
            </>
          )}
        </span>
        <strong>
          {happy
            ? count(results.filter((result) => result.rewarded !== null).length)
            : `${count(actual)} / ${count(estimated)}`}
        </strong>
      </div>
      <div>
        <span>Possible missed rewards</span>
        <strong>{count(outcomes.filter((outcome) => outcome.attention).length)}</strong>
      </div>
    </section>
  );
}
