import { useId, useState } from 'react';
import { referenceAverage, type ReferenceAverage } from '../../domain/calculate';
import type { Calculation } from '../../domain/types';
import { ProvisionalIndicator } from '../ProvisionalIndicator';
import { halfHourRange, number } from './format';
import { formatDate } from '../../domain/time';

function partialBaselineNote(summary: ReferenceAverage): string | null {
  if (summary.complete) return null;

  if (summary.missingCount > 0) {
    if (summary.average === null) {
      return summary.missingCount === 1
        ? '1 reference reading is missing, so this half-hour’s average cannot be calculated.'
        : `All ${summary.missingCount} reference readings are missing, so this half-hour’s average cannot be calculated.`;
    }

    const missingLabel =
      summary.missingCount === 1
        ? '1 reference reading is missing'
        : `${summary.missingCount} reference readings are missing`;
    const knownLabel =
      summary.knownCount === 1 ? '1 known reading' : `${summary.knownCount} known readings`;

    return `${missingLabel}, so this half-hour’s full baseline cannot be calculated yet. The average above uses only the ${knownLabel}.`;
  }

  const dayLabel =
    summary.knownCount === 1 ? '1 available day' : `${summary.knownCount} available days`;

  return `Not enough eligible reference days are available to calculate this half-hour’s full baseline. The average above uses only the ${dayLabel}.`;
}

export function ReferenceReadings({ result }: { result: Calculation }) {
  const id = useId();
  const [selected, setSelected] = useState(0);
  const slot = result.slots[selected] ?? result.slots[0];

  if (!slot) return null;

  const summary = referenceAverage(slot);
  const note = slot.references.length ? partialBaselineNote(summary) : null;
  const showPartialAverage = !summary.complete && summary.average !== null;

  return (
    <section aria-label="Baseline readings">
      <h3>Days used for baseline ({result.days.length})</h3>
      <label className="reference-time-picker" htmlFor={id}>
        Half-hour to inspect
        <select
          id={id}
          value={selected}
          onChange={(event) => setSelected(Number(event.target.value))}
        >
          {result.slots.map((candidate, index) => (
            <option key={candidate.start} value={index}>
              {halfHourRange(candidate.start)}
            </option>
          ))}
        </select>
      </label>
      {slot.references.length ? (
        <table className="reading-table reference-table" aria-label="Readings used for baseline">
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Usage (kWh)</th>
            </tr>
          </thead>
          <tbody>
            {slot.references.map((reference) => (
              <tr key={reference.date}>
                <th scope="row">
                  <time dateTime={reference.date}>{formatDate(reference.date)}</time>
                </th>
                <td>
                  <span className="reference-value">
                    {number(reference.value)}
                    {reference.provisional && reference.value !== null && <ProvisionalIndicator />}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">
                {showPartialAverage ? (
                  <>
                    Average of known readings
                    <span className="reference-average-detail">
                      {summary.missingCount > 0
                        ? `${summary.knownCount} of ${slot.references.length} days (${summary.missingCount} missing)`
                        : `${summary.knownCount} eligible ${summary.knownCount === 1 ? 'day' : 'days'} available`}
                    </span>
                  </>
                ) : (
                  'Average for this half-hour'
                )}
              </th>
              <td>
                <span className="reference-value">
                  {number(summary.average)}
                  {summary.provisional && summary.average !== null && <ProvisionalIndicator />}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <p>No eligible reference days are available.</p>
      )}
      {note && <p className="reading-note">{note}</p>}
      <div className="reading-explanation">
        <p>
          The same half-hour on earlier similar days is averaged. Bank holidays and session days are
          left out.
        </p>
      </div>
    </section>
  );
}
