import type { Calculation } from '../domain/types';
import { isHappyHour, MISSING_SESSION_EXPLANATION } from '../domain/session';
import { sessionOutcome } from '../domain/outcome';
import { CalculationSummary } from './readings/CalculationSummary';
import { ReferenceReadings } from './readings/ReferenceReadings';
import { OctopusComparison } from './readings/OctopusComparison';
import { PointsBreakdown } from './readings/PointsBreakdown';

export function SessionDetails({ result }: { result: Calculation }) {
  const outcome = sessionOutcome(result);

  return (
    <div className="session-details">
      {!isHappyHour(result.session) && result.session.resultsStatus === 'MISSING_READINGS' && (
        <p className="reading-note" role="note" aria-label="Octopus missing data">
          <strong>Missing data: </strong>
          {MISSING_SESSION_EXPLANATION} Your own estimate may differ from an average credit.
        </p>
      )}
      <CalculationSummary result={result} />
      {result.issues.length > 0 && (
        <div className="calculation-gaps">
          <h4>What’s missing</h4>
          <ul>
            {result.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      {outcome.attention && (
        <p className="reward-query">
          Possible missed reward: your readings suggest you qualify, but Octopus reports no reward.
        </p>
      )}
      <PointsBreakdown result={result} />
      {!isHappyHour(result.session) && (
        <p className="reading-note">
          Power down and Power up use electricity imported minus electricity exported.
        </p>
      )}
      {!isHappyHour(result.session) && <ReferenceReadings result={result} />}
      <OctopusComparison result={result} />
    </div>
  );
}
