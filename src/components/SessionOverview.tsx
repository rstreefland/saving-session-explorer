import type { ReactNode } from 'react';
import type { ColumnTotal, SessionTotals } from '../domain/totals';
import type { SessionType } from '../domain/session';
import { OctopointsValue } from './OctopointsValue';
import { PLACEHOLDER } from './placeholder';
import { ProvisionalIndicator } from './ProvisionalIndicator';
import { Tooltip } from './Tooltip';

function OverviewValue({
  total,
  unit,
}: {
  total: ColumnTotal;
  unit: 'energy' | 'points' | 'pence' | 'sessions';
}) {
  let value: ReactNode = PLACEHOLDER;
  if (total.value !== null) {
    if (unit === 'points') value = <OctopointsValue value={total.value} />;
    else if (unit === 'energy') value = <strong>{total.value.toFixed(2)} kWh</strong>;
    else if (unit === 'pence') value = <strong>{total.value.toString()}p</strong>;
    else value = <strong>{total.value.toString()} sessions</strong>;
  }
  return (
    <div className="overview-value">
      {value}
      {total.provisional && <ProvisionalIndicator />}
      <small>
        {total.available} of {total.sessions} results included
      </small>
    </div>
  );
}

export function SessionOverview({ totals, type }: { totals: SessionTotals; type: SessionType }) {
  const happy = type === 'WEEKEND_HAPPY_HOUR';
  const overview = totals.overview;
  return (
    <section className="session-overview" aria-label="Session overview">
      <header className="overview-heading">
        <h3>At a glance</h3>
        <span>{overview.sessions} joined sessions</span>
      </header>
      <table className="overview-table" role="table">
        <caption className="sr-only">Session overview comparison</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">
              In this view
            </th>
            <th scope="col" role="columnheader">
              Calculated
            </th>
            <th scope="col" role="columnheader">
              Octopus
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {!happy && (
            <tr role="row">
              <th scope="row" role="rowheader">
                Achieved or partly achieved
              </th>
              <td role="cell">
                <OverviewValue total={overview.calculatedAchievement} unit="sessions" />
              </td>
              <td role="cell">
                <OverviewValue total={overview.officialAchievement} unit="sessions" />
              </td>
            </tr>
          )}
          <tr role="row">
            <th scope="row" role="rowheader">
              {happy ? 'Energy used' : 'Energy shifted'}
            </th>
            <td role="cell">
              <OverviewValue total={totals.energy} unit="energy" />
            </td>
            <td role="cell">
              <OverviewValue total={totals.officialEnergy} unit="energy" />
            </td>
          </tr>
          <tr role="row" className="overview-reward">
            <th scope="row" role="rowheader">
              {happy ? 'Bill credit' : 'Reward'}
            </th>
            <td role="cell">
              {type === 'TURN_DOWN' ? (
                <OverviewValue total={totals.reward} unit="points" />
              ) : (
                <Tooltip
                  label="Not estimated"
                  text={
                    happy
                      ? 'Independent Happy Hours bill credit is not priced by this app.'
                      : 'Power up rewards need import tariff rates, which are not included in this estimate.'
                  }
                />
              )}
            </td>
            <td role="cell">
              <OverviewValue total={totals.officialReward} unit={happy ? 'pence' : 'points'} />
            </td>
          </tr>
        </tbody>
      </table>
      <footer className="overview-footer">
        {!happy && <strong>{overview.missedRewards} possible missed rewards</strong>}
        <div className="overview-availability">
          <span>{overview.pending} Octopus results pending</span>
          {overview.missing !== '0' && (
            <span>{overview.missing} Octopus results missing readings</span>
          )}
          {overview.upcoming !== '0' && <span>{overview.upcoming} upcoming sessions</span>}
          <span>{overview.unavailable} calculated results unavailable</span>
        </div>
        <Tooltip
          label="About these totals"
          text="Each count shows how many visible sessions contribute. Unavailable values and pending results are excluded, never counted as zero. Supplied Octopus average credits for sessions with missing readings can still contribute to reward totals. Columns can cover different sessions. Rewards sum individually rounded session awards; a difference is not proof of incorrect settlement."
        />
      </footer>
    </section>
  );
}
