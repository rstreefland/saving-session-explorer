import type { ReactNode } from 'react';
import type { ColumnTotal, SessionTotals } from '../domain/totals';
import type { SessionType } from '../domain/session';
import { OctopointsValue } from './OctopointsValue';
import { PLACEHOLDER } from './placeholder';
import { ProvisionalIndicator } from './ProvisionalIndicator';
import { Tooltip } from './Tooltip';

type OverviewRow = {
  label: string;
  calculated: ReactNode;
  official: ReactNode;
};

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
    </div>
  );
}

function OverviewLedger({
  title,
  source,
  rows,
}: {
  title: string;
  source: 'calculated' | 'official';
  rows: OverviewRow[];
}) {
  return (
    <div className={'overview-ledger overview-ledger-' + source} role="group" aria-label={title}>
      <h4>{title}</h4>
      <dl>
        {rows.map((row) => (
          <div className="overview-ledger-row" key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row[source]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function SessionOverview({ totals, type }: { totals: SessionTotals; type: SessionType }) {
  const happy = type === 'WEEKEND_HAPPY_HOUR';
  const overview = totals.overview;
  const rows: OverviewRow[] = [
    ...(!happy
      ? [
          {
            label: 'Achieved or partly achieved',
            calculated: <OverviewValue total={overview.calculatedAchievement} unit="sessions" />,
            official: <OverviewValue total={overview.officialAchievement} unit="sessions" />,
          },
        ]
      : []),
    {
      label: happy ? 'Energy used' : 'Energy shifted',
      calculated: <OverviewValue total={totals.energy} unit="energy" />,
      official: <OverviewValue total={totals.officialEnergy} unit="energy" />,
    },
    {
      label: happy ? 'Bill credit' : 'Reward',
      calculated:
        type === 'TURN_DOWN' ? (
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
        ),
      official: <OverviewValue total={totals.officialReward} unit={happy ? 'pence' : 'points'} />,
    },
  ];

  return (
    <section className="session-overview" aria-label="Session overview">
      <header className="overview-heading">
        <h3>At a glance</h3>
        <span>{overview.sessions} joined sessions</span>
      </header>
      <div className="overview-ledgers">
        <OverviewLedger title="Calculated" source="calculated" rows={rows} />
        <OverviewLedger title="Octopus" source="official" rows={rows} />
      </div>
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
      </footer>
    </section>
  );
}
