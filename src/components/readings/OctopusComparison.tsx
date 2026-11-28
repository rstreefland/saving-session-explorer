import type { Decimal, Numeric } from '../../domain/decimal';
import type { Calculation } from '../../domain/types';
import { isHappyHour, reportedShifted } from '../../domain/session';
import { number } from './format';
import { RewardRoundingExplanation } from '../RewardRoundingExplanation';

export function OctopusComparison({ result }: { result: Calculation }) {
  const happy = isHappyHour(result.session);

  const rows: [string, Decimal | Numeric | null, Decimal | Numeric | null][] = happy
    ? [['Imported', result.actual, reportedShifted(result.session)]]
    : [
        ['Baseline', result.baseline, result.session.baselineConsumptionDeltaKwh],
        ['Your usage', result.actual, result.session.consumptionDeltaKwh],
        ['Shifted for rewards', result.rewarded, reportedShifted(result.session)],
      ];

  return (
    <section aria-label="Octopus comparison">
      <h3>Compare with Octopus</h3>
      <table className="reading-table comparison-table" aria-label="Usage comparison">
        <thead>
          <tr>
            <th scope="col">kWh</th>
            <th scope="col">Calculated</th>
            <th scope="col">Octopus</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, ours, supplied]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{number(ours)}</td>
              <td>{number(supplied)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.difference !== null && (
        <p className="neutral-difference">
          Difference in {happy ? 'imported' : 'shifted'} energy:{' '}
          {result.difference.gte('0.0005') ? '+' : ''}
          {number(result.difference)} kWh (calculated minus Octopus).
        </p>
      )}
      {result.session.eventType === 'TURN_DOWN' && (
        <div className="reading-explanation">
          <RewardRoundingExplanation />
        </div>
      )}
      <p className="reading-note">
        Small numerical differences alone do not mean a reward is missing.
      </p>
    </section>
  );
}
