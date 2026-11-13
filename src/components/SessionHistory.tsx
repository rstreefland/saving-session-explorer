import { Fragment, useId, useState } from 'react';
import { CalendarClock, ChevronDown } from 'lucide-react';
import type { Calculation, Session } from '../domain/types';
import {
  SESSION_TYPES,
  isHappyHour,
  reportedShifted,
  MISSING_SESSION_EXPLANATION,
  type SessionType,
} from '../domain/session';
import { sessionOutcome, type SessionOutcome } from '../domain/outcome';
import { formatDate, formatTimeRange } from '../domain/time';
import { SessionDetails } from './SessionDetails';
import { ProvisionalIndicator } from './ProvisionalIndicator';
import { Tooltip } from './Tooltip';
import { OctopointsValue } from './OctopointsValue';
import { estimateOctopoints } from '../domain/points';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { SessionOverview } from './SessionOverview';
import { officialRewardValue, type SessionTotals } from '../domain/totals';
import { PLACEHOLDER } from './placeholder';

const statuses: Record<string, { label: string; tone: SessionOutcome['tone'] }> = {
  SUCCESS: { label: 'Achieved', tone: 'positive' },
  PARTIAL_SUCCESS: { label: 'Partly achieved', tone: 'positive' },
  FAIL: { label: 'Not achieved', tone: 'negative' },
  MISSING_READINGS: { label: 'Missing data', tone: 'waiting' },
  CALCULATING: { label: 'Pending', tone: 'waiting' },
  UPCOMING: { label: 'Upcoming', tone: 'waiting' },
};

function status(session: Session) {
  return statuses[session.resultsStatus ?? ''] ?? { label: 'Pending', tone: 'waiting' };
}

function reward(session: Session) {
  const value = officialRewardValue(session);

  if (value == null) return PLACEHOLDER;
  if (isHappyHour(session)) return value + 'p';

  return <OctopointsValue value={value} />;
}

function UpcomingSessionIndicator({ session }: { session: Session }) {
  if (Date.parse(session.endAt) <= Date.now()) return null;

  return (
    <Tooltip
      label="Session has not ended yet"
      icon={<CalendarClock size={14} aria-hidden="true" />}
      text="This session has not ended yet. You can inspect your baseline but calculated results won't show until we've received either smart meter readings or figures from your Octopus Home Mini if you have one."
    />
  );
}

function ShiftedEnergy({ value }: { value: number | null }) {
  return (
    <small className="shifted-energy">
      {value === null ? PLACEHOLDER : `${value.toFixed(2)} kWh shifted`}
    </small>
  );
}

function calculatedReward(result: Calculation) {
  const estimate = estimateOctopoints(result);

  return estimate.state === 'ready' ? <OctopointsValue value={estimate.points} /> : PLACEHOLDER;
}

function MobileResults({
  results,
  type,
  id,
  expanded,
  toggle,
}: {
  results: Calculation[];
  type: SessionType;
  id: string;
  expanded: Set<number>;
  toggle: (eventId: number) => void;
}) {
  const happy = type === 'WEEKEND_HAPPY_HOUR';
  return (
    <ol className="mobile-results" aria-label="Session results">
      {results.map((result) => {
        const session = result.session;
        const outcome = sessionOutcome(result);
        const done = status(session);
        const open = expanded.has(session.eventId);
        const date = formatDate(session.startAt);
        const detailId = id + '-mobile-details-' + session.eventId;
        const comparison = (
          <div className="mobile-comparison">
            {[true, false].map((estimated) => {
              const energy = estimated ? result.rewarded : reportedShifted(session);
              const state = estimated ? outcome : done;
              return (
                <div className="mobile-source" key={String(estimated)}>
                  <span className="mobile-source-label">
                    {estimated ? 'Calculated' : 'Octopus'}
                  </span>
                  <div className="mobile-source-result">
                    {!happy && (
                      <span className={'outcome-label outcome-' + state.tone}>
                        {!estimated && session.resultsStatus === 'MISSING_READINGS' ? (
                          <Tooltip label={state.label} text={MISSING_SESSION_EXPLANATION} />
                        ) : (
                          state.label
                        )}
                        {estimated && result.provisional && <ProvisionalIndicator />}
                      </span>
                    )}
                    <span className="mobile-energy">
                      {energy === null
                        ? PLACEHOLDER
                        : energy.toFixed(2) + (happy ? ' kWh used' : ' kWh shifted')}
                      {happy && estimated && result.provisional && <ProvisionalIndicator />}
                    </span>
                  </div>
                  {(!estimated || type === 'TURN_DOWN') && (
                    <div className="mobile-source-reward">
                      {estimated ? calculatedReward(result) : reward(session)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
        return (
          <li
            key={session.eventId}
            className={'mobile-session' + (outcome.attention ? ' mobile-session-attention' : '')}
          >
            <div className="mobile-session-heading">
              <div>
                <span className="mobile-session-time">
                  {formatTimeRange(session.startAt, session.endAt)}
                  <UpcomingSessionIndicator session={session} />
                </span>
                <time dateTime={session.startAt}>{date}</time>
              </div>
              <button
                type="button"
                className="mobile-details-toggle"
                aria-label={
                  'Readings for ' + date + ', ' + formatTimeRange(session.startAt, session.endAt)
                }
                aria-expanded={open}
                aria-controls={detailId}
                onClick={() => toggle(session.eventId)}
              >
                <ChevronDown size={20} aria-hidden="true" />
              </button>
            </div>
            {outcome.attention && <p className="mobile-attention">Possible missed reward</p>}
            {comparison}
            {open && (
              <div id={detailId} className="mobile-session-details">
                <SessionDetails result={result} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function SessionHistory({
  results,
  type,
  onTypeChange,
  totals,
}: {
  results: Calculation[];
  type: SessionType;
  onTypeChange: (type: SessionType) => void;
  totals?: SessionTotals;
}) {
  const id = useId(),
    [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  const phone = useMediaQuery('(max-width: 600px)');
  function toggle(eventId: number) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }
  const happy = type === 'WEEKEND_HAPPY_HOUR';
  const compact = useMediaQuery('(max-width: 800px)');
  const estimateReward = type === 'TURN_DOWN';
  const columns = compact ? 4 : estimateReward ? 6 : 5;

  function changeTab(index: number) {
    const next = SESSION_TYPES[(index + SESSION_TYPES.length) % SESSION_TYPES.length].value;

    onTypeChange(next);
    document.getElementById(id + '-' + next)?.focus();
  }

  return (
    <div className="history">
      <div className="session-tabs" role="tablist" aria-label="Session type">
        {SESSION_TYPES.map((tab, index) => (
          <button
            key={tab.value}
            id={id + '-' + tab.value}
            role="tab"
            aria-selected={type === tab.value}
            aria-controls={id + '-panel'}
            tabIndex={type === tab.value ? 0 : -1}
            onClick={() => onTypeChange(tab.value)}
            onKeyDown={(e) => {
              if (
                e.key === 'ArrowRight' ||
                e.key === 'ArrowLeft' ||
                e.key === 'Home' ||
                e.key === 'End'
              ) {
                e.preventDefault();
                changeTab(
                  e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? 2
                      : index + (e.key === 'ArrowRight' ? 1 : -1),
                );
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={id + '-panel'} aria-labelledby={id + '-' + type} tabIndex={0}>
        {totals && results.length > 0 && <SessionOverview totals={totals} type={type} />}
        {phone ? (
          <MobileResults
            results={results}
            type={type}
            id={id}
            expanded={expanded}
            toggle={toggle}
          />
        ) : (
          <div className="table-scroll history-scroll">
            {/* Explicit roles preserve table navigation when the compact layout uses CSS grid. */}
            <table className="history-table" role="table">
              <caption className="sr-only">
                {SESSION_TYPES.find((t) => t.value === type)!.label} session history
              </caption>
              <thead role="rowgroup">
                <tr role="row">
                  <th role="columnheader" scope="col" className="sticky-date">
                    Date
                  </th>
                  <th role="columnheader" scope="col">
                    <Tooltip
                      label={happy ? 'Calculated usage' : 'Calculated result'}
                      text="Estimated figures produced by looking at your smart meter data. May differ to the actual figures from Octopus Energy."
                    />
                  </th>
                  <th role="columnheader" scope="col">
                    <Tooltip
                      label={happy ? 'Usage' : 'Result'}
                      text="Actual figures from Octopus Energy."
                    />
                  </th>
                  {!compact && estimateReward && (
                    <th role="columnheader" scope="col" className="reward-column">
                      <Tooltip
                        label="Calculated reward"
                        text="Estimated Octopoints from shifted energy and the session rate."
                      />
                    </th>
                  )}
                  {!compact && (
                    <th role="columnheader" scope="col" className="reward-column">
                      <Tooltip label="Reward" text="Actual figures from Octopus Energy." />
                    </th>
                  )}
                  <th role="columnheader" scope="col" className="readings-column">
                    <span className="sr-only">Readings</span>
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {results.map((result, index) => {
                  const session = result.session,
                    done = status(session),
                    officialShifted = reportedShifted(session),
                    outcome = sessionOutcome(result),
                    open = expanded.has(session.eventId);

                  const date = formatDate(session.startAt);

                  const timeRange = formatTimeRange(session.startAt, session.endAt);

                  const label =
                    SESSION_TYPES.find((t) => t.value === session.eventType)!.label + ' ' + date;

                  return (
                    <Fragment key={session.eventId}>
                      <tr
                        role="row"
                        className={
                          'history-row ' +
                          (index % 2 ? 'stripe ' : '') +
                          (outcome.attention ? 'row-attention' : '')
                        }
                      >
                        <th role="rowheader" scope="row" className="session-date">
                          <span className="session-time">{timeRange}</span>
                          <time dateTime={session.startAt}>
                            {date}
                            <UpcomingSessionIndicator session={session} />
                          </time>
                        </th>
                        <td role="cell" className="outcome-cell">
                          <div className="result-summary">
                            {happy ? (
                              <span className="numeric">
                                {result.rewarded === null
                                  ? PLACEHOLDER
                                  : result.rewarded.toFixed(2) + ' kWh'}
                                {result.provisional && <ProvisionalIndicator />}
                              </span>
                            ) : (
                              <>
                                <span className={'outcome-label outcome-' + outcome.tone}>
                                  {outcome.label}
                                  {result.provisional && <ProvisionalIndicator />}
                                </span>
                                <ShiftedEnergy value={result.rewarded} />
                              </>
                            )}
                          </div>
                          {compact && estimateReward && (
                            <span className="mobile-reward">
                              <span className="mobile-reward-label">Octopoints</span>
                              {calculatedReward(result)}
                            </span>
                          )}
                          {outcome.attention && (
                            <span className="reward-query">
                              Possible missed reward
                              <small>
                                Your readings suggest you qualify, but Octopus has awarded no
                                reward.
                              </small>
                            </span>
                          )}
                        </td>
                        <td role="cell" className="outcome-cell">
                          <div className="result-summary">
                            {happy ? (
                              <span className="numeric">
                                {officialShifted === null
                                  ? PLACEHOLDER
                                  : officialShifted.toFixed(2) + ' kWh'}
                              </span>
                            ) : (
                              <>
                                <span className={'outcome-label outcome-' + done.tone}>
                                  {session.resultsStatus === 'MISSING_READINGS' ? (
                                    <Tooltip
                                      label={done.label}
                                      text={MISSING_SESSION_EXPLANATION}
                                    />
                                  ) : (
                                    done.label
                                  )}
                                </span>
                                <ShiftedEnergy value={officialShifted} />
                              </>
                            )}
                          </div>
                          {compact && (
                            <span className="mobile-reward">
                              <span className="mobile-reward-label">
                                {happy ? 'Bill credit' : 'Octopoints'}
                              </span>
                              {reward(session)}
                            </span>
                          )}
                        </td>
                        {!compact && estimateReward && (
                          <td role="cell" className="numeric reward-cell reward-column">
                            {calculatedReward(result)}
                          </td>
                        )}
                        {!compact && (
                          <td role="cell" className="numeric reward-cell reward-column">
                            {reward(session)}
                          </td>
                        )}
                        <td role="cell" className="readings-column">
                          <button
                            type="button"
                            className="row-toggle"
                            aria-label={'Readings for ' + label + ', ' + timeRange}
                            aria-expanded={open}
                            aria-controls={id + '-details-' + session.eventId}
                            onClick={() =>
                              setExpanded((previous) => {
                                const next = new Set(previous);

                                if (next.has(session.eventId)) next.delete(session.eventId);
                                else next.add(session.eventId);

                                return next;
                              })
                            }
                          >
                            <ChevronDown size={20} aria-hidden="true" focusable="false" />
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr
                          role="row"
                          className="details-row"
                          id={id + '-details-' + session.eventId}
                        >
                          <td role="cell" colSpan={columns} aria-colspan={columns}>
                            <SessionDetails result={result} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!results.length && (
          <div className="empty">
            <h3>No sessions in this view</h3>
            <p>Try another period. Only joined sessions appear.</p>
          </div>
        )}
      </div>
    </div>
  );
}
