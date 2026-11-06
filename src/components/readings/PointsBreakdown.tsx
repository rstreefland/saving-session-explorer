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

const precise = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 6 });

export function PointsBreakdown({ result }: { result: Calculation }) {
  if (isHappyHour(result.session) || result.session.eventType === 'TURN_UP') return null;

  const estimate = estimateOctopoints(result);
  const actual = actualOctopoints(result.session);

  return (
    <section className="points-breakdown" aria-label="Octopoints estimate">
      <h4>Octopoints estimate</h4>
      {estimate.state === 'ready' ? (
        <>
          <ol className="points-steps">
            <li>
              <strong>Shifted energy × session rate</strong>
              <p>
                {precise(estimate.shifted)} kWh × {precise(estimate.rate)} points/kWh ={' '}
                {precise(estimate.raw)} points.
              </p>
            </li>
            <li>
              <strong>Round up to a whole penny</strong>
              <p>
                {precise(estimate.raw)} → {estimate.pennyRounded} points ({POINTS_PER_PENNY} points
                = 1p).
              </p>
            </li>
            <li>
              <strong>Apply the assumed 2p minimum</strong>
              <p>
                {estimate.raw === 0
                  ? 'No points earned, so no minimum applies.'
                  : estimate.pennyRounded < ASSUMED_MINIMUM_POINTS
                    ? `${estimate.pennyRounded} → ${ASSUMED_MINIMUM_POINTS} points.`
                    : 'Already at or above 16 points, so no change.'}
              </p>
            </li>
          </ol>
          <p className="reading-note">
            Penny rounding and the 2p minimum were inferred from the account results checked. The
            exact formula has not been published by Octopus, so these are assumptions.
          </p>
        </>
      ) : (
        <p>{POINTS_UNAVAILABLE[estimate.reason]}</p>
      )}
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
              : estimate.difference === 0
                ? '0 Octopoints. Matches Octopus.'
                : `${estimate.difference > 0 ? '+' : ''}${estimate.difference.toLocaleString('en-GB')} Octopoints (calculated minus Octopus).`}
          </dd>
        </div>
      </dl>
    </section>
  );
}
