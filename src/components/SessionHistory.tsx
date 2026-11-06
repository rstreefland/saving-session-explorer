import { Fragment, useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Calculation, Session } from '../domain/types';
import {
  SESSION_TYPES,
  isHappyHour,
  reportedShifted,
  MISSING_SESSION_EXPLANATION,
  type SessionType,
} from '../domain/session';
import { sessionOutcome, type SessionOutcome } from '../domain/outcome';
import { formatLocal } from '../domain/time';
import { SessionDetails } from './SessionDetails';
import { ProvisionalIndicator } from './ProvisionalIndicator';
import { Tooltip } from './Tooltip';
import { OctopointsValue } from './OctopointsValue';
import { estimateOctopoints } from '../domain/points';
import { useMediaQuery } from '../hooks/useMediaQuery';
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
  if (['CALCULATING', 'UPCOMING'].includes(session.resultsStatus ?? '') || !session.resultsStatus)
    return PLACEHOLDER;

  const value = isHappyHour(session) ? session.rewardGivenInPence : session.rewardGivenInOctoPoints;

  if (value == null) return PLACEHOLDER;
  if (isHappyHour(session)) return value + 'p';

  return <OctopointsValue value={value} />;
}

function sessionTime(value: string) {
  return formatLocal(value, { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' }).replace(
    /\s(?=[ap]m)/g,
    '',
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

export function SessionHistory({
  results,
  type,
  onTypeChange,
  summary,
}: {
  results: Calculation[];
  type: SessionType;
  onTypeChange: (type: SessionType) => void;
  summary?: ReactNode;
}) {
  const id = useId(),
    [expanded, setExpanded] = useState<Set<number>>(() => new Set());

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
        {summary}
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

                const date = formatLocal(session.startAt, {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                });

                const startTime = sessionTime(session.startAt);
                const endTime = sessionTime(session.endAt);
                const fullTimeRange = `${startTime} – ${endTime}`;
                const samePeriod = startTime.slice(-2) === endTime.slice(-2);
                const visibleTimeRange = compact
                  ? `${samePeriod ? startTime.slice(0, -2) : startTime}–${endTime}`
                  : fullTimeRange;

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
                        <span className="session-time">
                          <span className="sr-only">{fullTimeRange}</span>
                          <span aria-hidden="true">{visibleTimeRange}</span>
                        </span>
                        <time dateTime={session.startAt}>{date}</time>
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
                              Your readings suggest you qualify, but Octopus has awarded no reward.
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
                                  <Tooltip label={done.label} text={MISSING_SESSION_EXPLANATION} />
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
                          aria-label={'Readings for ' + label}
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
        {!results.length && (
          <div className="empty">
            <h3>No sessions in this view</h3>
            <p>Try another period. Only joined, ended sessions appear.</p>
          </div>
        )}
      </div>
    </div>
  );
}
