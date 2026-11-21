import { useId, useState } from 'react';
import { decimal } from '../domain/decimal';
import { number } from './readings/format';
import type { Calculation } from '../domain/types';
import { isHappyHour, MISSING_SESSION_EXPLANATION } from '../domain/session';
import { sessionOutcome } from '../domain/outcome';
import { CalculationSummary } from './readings/CalculationSummary';
import { ReferenceReadings } from './readings/ReferenceReadings';
import { OctopusComparison } from './readings/OctopusComparison';
import { PointsBreakdown } from './readings/PointsBreakdown';

export type DetailTab = 'energy' | 'points' | 'baseline' | 'compare';

export function SessionDetails({
  result,
  selectedTab,
  onTabChange,
}: {
  result: Calculation;
  selectedTab?: DetailTab;
  onTabChange?: (tab: DetailTab) => void;
}) {
  const id = useId();
  const [localTab, setLocalTab] = useState<DetailTab>('energy');
  const happy = isHappyHour(result.session);
  const tabs: { key: DetailTab; label: string; content: React.ReactNode }[] = [
    { key: 'energy', label: 'Energy', content: <CalculationSummary result={result} /> },
  ];
  if (result.session.eventType === 'TURN_DOWN') {
    tabs.push({ key: 'points', label: 'Octopoints', content: <PointsBreakdown result={result} /> });
  }
  if (!happy && result.slots.length > 0) {
    tabs.push({
      key: 'baseline',
      label: 'Baseline',
      content: <ReferenceReadings result={result} />,
    });
  }
  tabs.push({ key: 'compare', label: 'Compare', content: <OctopusComparison result={result} /> });
  const requestedTab = selectedTab ?? localTab;
  const activeTab = tabs.some(({ key }) => key === requestedTab) ? requestedTab : 'energy';
  const selectTab = onTabChange ?? setLocalTab;

  const outcome = sessionOutcome(result);

  return (
    <div className="session-details">
      {!isHappyHour(result.session) && result.session.resultsStatus === 'MISSING_READINGS' && (
        <p className="reading-note" role="note" aria-label="Octopus missing data">
          <strong>Missing data: </strong>
          {MISSING_SESSION_EXPLANATION} Your own estimate may differ from an average credit.
        </p>
      )}
      <dl className="calculation-total" role="group" aria-label="Session energy total">
        <dt>{happy ? 'Total imported' : 'Total shifted for rewards'}</dt>
        <dd>
          {number(result.rewarded)}
          {result.rewarded !== null && ' kWh'}
        </dd>
      </dl>
      {result.issues.length > 0 && (
        <div className="calculation-gaps">
          <h4>What’s missing</h4>
          <ul>
            {result.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      {outcome.attention && (
        <p className="reward-query">
          Possible missed reward: your readings suggest you qualify, but Octopus reports no reward.
        </p>
      )}
      <div className="detail-tabs" role="tablist" aria-label="Session details">
        {tabs.map(({ key, label }, index) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={id + '-' + key}
            aria-controls={id + '-panel-' + key}
            aria-selected={activeTab === key}
            tabIndex={activeTab === key ? 0 : -1}
            onClick={() => selectTab(key)}
            onKeyDown={(event) => {
              let nextIndex: number;
              switch (event.key) {
                case 'ArrowRight':
                  nextIndex = decimal(index).plus(1).mod(tabs.length).toNumber();
                  break;
                case 'ArrowLeft':
                  nextIndex = decimal(index).plus(tabs.length).minus(1).mod(tabs.length).toNumber();
                  break;
                case 'Home':
                  nextIndex = 0;
                  break;
                case 'End':
                  nextIndex = decimal(tabs.length).minus(1).toNumber();
                  break;
                default:
                  return;
              }
              event.preventDefault();
              const next = tabs[nextIndex].key;
              selectTab(next);
              document.getElementById(id + '-' + next)?.focus();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tabs.map(({ key, content }) => (
        <div
          key={key}
          className="detail-panel"
          role="tabpanel"
          id={id + '-panel-' + key}
          aria-labelledby={id + '-' + key}
          hidden={activeTab !== key}
          tabIndex={0}
        >
          {content}
        </div>
      ))}
    </div>
  );
}
