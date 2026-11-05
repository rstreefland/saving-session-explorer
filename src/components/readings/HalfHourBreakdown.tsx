import { PLACEHOLDER } from '../placeholder';
import type { Calculation } from '../../domain/types';
import { isHappyHour } from '../../domain/session';
import { clockTime } from '../../domain/time';
import { halfHourEnd, number } from './format';

export function HalfHourBreakdown({ result }: { result: Calculation }) {
  const happy = isHappyHour(result.session);
  const direction = result.session.eventType === 'TURN_UP' ? -1 : 1;
  return (
    <section className="half-hour-breakdown" aria-label="Half-hour breakdown">
      <h4>Half-hour breakdown</h4>
      {!happy && (
        <p>
          For each half-hour, the amount used {direction === -1 ? 'above' : 'below'} baseline is
          counted. Half-hours where you used {direction === -1 ? 'less' : 'more'} count as zero.
        </p>
      )}
      <p className="reading-note">All energy figures are in kWh. Times are UK local time.</p>
      <table className={'reading-table' + (happy ? ' happy-readings' : '')}>
        <caption className="sr-only">Half-hour readings (kWh)</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            {!happy && <th scope="col">Baseline</th>}
            <th scope="col">Used</th>
            {!happy && <th scope="col">Shifted</th>}
          </tr>
        </thead>
        <tbody>
          {result.slots.map((slot) => {
            const shifted =
              slot.baseline === null || slot.actual === null
                ? null
                : Math.max(0, (slot.baseline - slot.actual) * direction);
            return (
              <tr key={slot.start}>
                <th scope="row">
                  <time dateTime={slot.start}>
                    {clockTime(slot.start)}
                    <span className="reading-time-end">to {halfHourEnd(slot.start)}</span>
                  </time>
                </th>
                {!happy && <td>{number(slot.baseline)}</td>}
                <td>{number(slot.actual)}</td>
                {!happy && <td className="shifted-reading">{number(shifted)}</td>}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={happy ? 1 : 3}>
              {happy ? 'Total imported' : 'Total shifted for rewards'}
            </th>
            <td>{result.rewarded === null ? PLACEHOLDER : number(result.rewarded)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
