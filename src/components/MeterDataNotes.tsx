import type { readingCoverage } from '../domain/coverage';
import { clockTime, formatLocal } from '../domain/time';

export function MeterDataNotes({
  coverage,
  warnings,
}: {
  coverage: ReturnType<typeof readingCoverage> | null;
  warnings: string[];
}) {
  if (!coverage?.gaps.length && !warnings.length) return null;
  const showMeter = coverage?.gaps.some((gap) => gap.meters !== 'import');
  const date = (value: string) =>
    formatLocal(value, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }) +
    ', ' +
    clockTime(value, true);
  return (
    <details className="data-notes">
      <summary>Missing data?</summary>
      {!!coverage?.gaps.length && (
        <>
          <p>
            Smart-meter readings travel via the{' '}
            <a href="https://www.smartdcc.co.uk/our-smart-network/how-do-smart-meters-send-readings/">
              DCC network
            </a>{' '}
            and usually appear the next day, but can take{' '}
            <a href="https://octopus.energy/help-and-faqs/articles/why-are-my-usage-graphs-showing-an-error-message/">
              a few days
            </a>
            . We label gaps up to{' '}
            <a href="https://octopus.energy/blog/track-my-energy-use/">a week</a> old “Pending” and
            older gaps “Presumed missing”; late readings may still arrive.
          </p>
          <table className="reading-table meter-gaps" aria-label="Missing meter readings">
            <thead>
              <tr>
                <th scope="col">From</th>
                <th scope="col">To</th>
                {showMeter && <th scope="col">Readings</th>}
                <th scope="col">Status</th>
                <th scope="col">Home Mini data available</th>
              </tr>
            </thead>
            <tbody>
              {coverage.gaps.map((gap) => (
                <tr key={gap.start}>
                  <td>
                    <time dateTime={gap.start}>{date(gap.start)}</time>
                  </td>
                  <td>
                    <time dateTime={gap.end}>{date(gap.end)}</time>
                  </td>
                  {showMeter && <td>{gap.meters}</td>}
                  <td>{gap.status === 'pending' ? 'Pending' : 'Presumed missing'}</td>
                  <td>
                    {gap.homeMiniCount === 0
                      ? 'No'
                      : gap.meters !== 'import'
                        ? 'Partial (import only)'
                        : gap.homeMiniCount === gap.count
                          ? 'Yes'
                          : 'Partial'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {warnings.map((warning) => (
        <p key={warning}>{warning}</p>
      ))}
    </details>
  );
}
