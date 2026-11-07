import { useId, useState } from 'react';
import type { Calculation } from '../../domain/types';
import { halfHourRange, number } from './format';
import { formatDate } from '../../domain/time';
import { ReadingDisclosure } from './ReadingDisclosure';

export function ReferenceReadings({ result }: { result: Calculation }) {
  const id = useId();
  const [selected, setSelected] = useState(0);
  const slot = result.slots[selected] ?? result.slots[0];

  if (!slot) return null;

  return (
    <ReadingDisclosure title={`Days used for baseline (${result.days.length})`}>
      <p>
        The same half-hour on earlier similar days is averaged. Bank holidays and session days are
        left out.
      </p>
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
                <td>{number(reference.value)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Average for this half-hour</th>
              <td>{number(slot.baseline)}</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <p>No eligible reference days are available.</p>
      )}
      {slot.references.some((reference) => reference.value === null) && (
        <p className="reading-note">
          This half-hour’s average cannot be calculated while a reference reading is missing.
        </p>
      )}
    </ReadingDisclosure>
  );
}
