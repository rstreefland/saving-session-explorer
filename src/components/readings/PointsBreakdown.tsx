import { formatNumeric, type Decimal } from '../../domain/decimal';
import type { Calculation } from '../../domain/types';
import {
  actualOctopoints,
  estimateOctopoints,
  POINTS_UNAVAILABLE,
  POINTS_PER_PENNY,
  ASSUMED_MINIMUM_POINTS,
} from '../../domain/points';
import { isHappyHour } from '../../domain/session';
import { PLACEHOLDER } from '../placeholder';
import { OctopointsValue } from '../OctopointsValue';

const precise = (value: Decimal) => formatNumeric(value, 6);

export function PointsBreakdown({ result }: { result: Calculation }) {
  if (isHappyHour(result.session) || result.session.eventType === 'TURN_UP') return null;

  const estimate = estimateOctopoints(result);
  const actual = actualOctopoints(result.session);

  return (
    <section className="points-breakdown" aria-label="Octopoints estimate">
      <h3>Octopoints estimate</h3>
      <dl className="points-comparison">
        <div>
          <dt>Calculated reward</dt>
          <dd>
            {estimate.state === 'ready' ? <OctopointsValue value={estimate.points} /> : PLACEHOLDER}
          </dd>
        </div>
        <div>
          <dt>Actual reward</dt>
          <dd>{actual !== null ? <OctopointsValue value={actual} /> : PLACEHOLDER}</dd>
        </div>
        <div>
          <dt>Difference</dt>
          <dd>
            {estimate.state !== 'ready' || estimate.difference === null
              ? PLACEHOLDER
              : estimate.difference.isZero()
                ? '0 Octopoints. Matches Octopus.'
                : `${estimate.difference.gt(0) ? '+' : ''}${formatNumeric(estimate.difference)} Octopoints (calculated minus Octopus).`}
          </dd>
        </div>
      </dl>
      {estimate.state === 'ready' ? (
        <>
          <table className="reading-table points-steps" aria-label="Octopoints calculation steps">
            <thead>
              <tr>
                <th scope="col">Step</th>
                <th scope="col">Calculation</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Shifted energy × session rate</th>
                <td>
                  {precise(estimate.shifted)} kWh × {precise(estimate.rate)} points/kWh
                </td>
                <td>{precise(estimate.raw)} points</td>
              </tr>
              <tr>
                <th scope="row">Round up to a whole penny</th>
                <td>{precise(estimate.raw)} points before rounding</td>
                <td>{estimate.pennyRounded.toString()} points</td>
              </tr>
              <tr>
                <th scope="row">Apply the assumed 2p minimum</th>
                <td>
                  {estimate.raw.isZero()
                    ? 'No points earned, so no minimum applies.'
                    : estimate.pennyRounded.lt(ASSUMED_MINIMUM_POINTS)
                      ? `${estimate.pennyRounded.toString()} points before the minimum`
                      : 'Already at or above 16 points, so no change.'}
                </td>
                <td>{formatNumeric(estimate.points)} points</td>
              </tr>
            </tbody>
          </table>
          <div className="reading-explanation">
            <p>
              {POINTS_PER_PENNY} points equal 1p. Penny rounding and the 2p minimum were inferred
              from the account results checked. The exact formula has not been published by Octopus,
              so these are assumptions.
            </p>
          </div>
        </>
      ) : (
        <p className="reading-note">{POINTS_UNAVAILABLE[estimate.reason]}</p>
      )}
    </section>
  );
}
