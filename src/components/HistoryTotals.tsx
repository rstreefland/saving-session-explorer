import type { ColumnTotal, SessionTotals } from '../domain/totals';
import type { SessionType } from '../domain/session';
import { OctopointsValue } from './OctopointsValue';
import { PLACEHOLDER } from './placeholder';
import { ProvisionalIndicator } from './ProvisionalIndicator';
import { Tooltip } from './Tooltip';

function TotalValue({ total, unit }: { total: ColumnTotal; unit: 'energy' | 'points' | 'pence' }) {
  return (
    <div className={unit === 'energy' ? 'total-value total-energy' : 'total-value'}>
      {total.value === null ? (
        PLACEHOLDER
      ) : unit === 'points' ? (
        <OctopointsValue value={total.value.toNumber()} />
      ) : (
        <strong>
          {unit === 'energy' ? `${total.value.toFixed(2)} kWh` : `${total.value.toString()}p`}
        </strong>
      )}
      {total.provisional && <ProvisionalIndicator />}
      <small>
        {total.available} of {total.sessions} results included
      </small>
    </div>
  );
}

export function HistoryTotals({
  totals,
  type,
  mobile = false,
  compact = false,
}: {
  totals: SessionTotals;
  type: SessionType;
  mobile?: boolean;
  compact?: boolean;
}) {
  const estimateReward = type === 'TURN_DOWN';
  const rewardUnit = type === 'WEEKEND_HAPPY_HOUR' ? 'pence' : 'points';
  const label = (
    <Tooltip
      label="Totals"
      text="Sums for the visible sessions. The count shows how many visible sessions contribute to each total. Missing or pending values are excluded, never counted as zero. Each column can cover different sessions. Session rewards are added after their individual rounding."
    />
  );
  if (mobile)
    return (
      <section className="history-totals mobile-totals" aria-label="Session totals">
        <h3>{label}</h3>
        <div className="totals-sources">
          <div>
            <h4>Calculated</h4>
            <TotalValue total={totals.energy} unit="energy" />
            {estimateReward && <TotalValue total={totals.reward} unit="points" />}
          </div>
          <div>
            <h4>Octopus</h4>
            <TotalValue total={totals.officialEnergy} unit="energy" />
            <TotalValue total={totals.officialReward} unit={rewardUnit} />
          </div>
        </div>
      </section>
    );
  return (
    <tfoot className="history-totals" role="rowgroup">
      <tr role="row">
        <th scope="row" role="rowheader">
          {label}
        </th>
        <td role="cell">
          <TotalValue total={totals.energy} unit="energy" />
          {compact && estimateReward && <TotalValue total={totals.reward} unit="points" />}
        </td>
        <td role="cell">
          <TotalValue total={totals.officialEnergy} unit="energy" />
          {compact && <TotalValue total={totals.officialReward} unit={rewardUnit} />}
        </td>
        {!compact && estimateReward && (
          <td role="cell">
            <TotalValue total={totals.reward} unit="points" />
          </td>
        )}
        {!compact && (
          <td role="cell">
            <TotalValue total={totals.officialReward} unit={rewardUnit} />
          </td>
        )}
        <td role="cell" />
      </tr>
    </tfoot>
  );
}
