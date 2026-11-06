import { useEffect, useMemo, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { loadDataset } from './api/client';
import { createQueryClient } from './api/queryClient';
import { dataWarnings } from './domain/availability';
import { calculateAll } from './domain/calculate';
import { last30Days, validRange, type Preset } from './domain/dateRange';
import { day, formatLocal, milliseconds, todayInLondon } from './domain/time';
import { readingCoverage } from './domain/coverage';
import { demoDataset } from './domain/demo';
import type { Dataset } from './domain/types';
import { LoadingState } from './components/LoadingState';
import { ConnectionForm } from './components/ConnectionForm';
import { DateFilters } from './components/DateFilters';
import { SessionHistory } from './components/SessionHistory';
import { SessionSummary } from './components/SessionSummary';
import { Methodology } from './components/Methodology';
import type { SessionType } from './domain/session';
import { useSessionData } from './hooks/useSessionData';
import { readAccount, readKey } from './domain/storage';

interface AppProps {
  load?: typeof loadDataset;
}

export default function App(props: AppProps = {}) {
  const [client] = useState(createQueryClient);

  useEffect(() => () => client.clear(), [client]);

  return (
    <QueryClientProvider client={client}>
      <SessionLens {...props} />
    </QueryClientProvider>
  );
}

function SessionLens({ load }: AppProps) {
  const [range, setRange] = useState(() => last30Days());
  const [selected, setSelected] = useState<Preset | 'custom'>('30d');
  const [demo, setDemo] = useState<Dataset | null>(null);
  const [validationError, setValidationError] = useState('');
  const [type, setType] = useState<SessionType>('TURN_DOWN');

  const remote = useSessionData(load, () => {
    const key = readKey().trim();
    const account = readAccount().trim();

    return key && /^A-[A-Za-z0-9]+$/.test(account)
      ? { key, account, region: 'auto', ...range }
      : null;
  });

  const data = demo ?? remote.data;
  const { from, to } = range;
  const results = useMemo(() => (data ? calculateAll(data) : []), [data]);

  const coverage = useMemo(
    () =>
      data && validRange(from, to)
        ? readingCoverage(
            type === 'WEEKEND_HAPPY_HOUR' ? { ...data, exports: null } : data,
            from,
            to,
          )
        : null,
    [data, from, to, type],
  );

  const visible = results
    .filter(
      (r) =>
        r.session.eventType === type &&
        day(r.session.startAt) >= from &&
        day(r.session.startAt) <= to,
    )
    .sort(
      (a, b) =>
        milliseconds(b.session.startAt) - milliseconds(a.session.startAt) ||
        b.session.eventId - a.session.eventId,
    );

  const warnings = data && type !== 'WEEKEND_HAPPY_HOUR' ? dataWarnings(data) : [];
  const error = validationError || remote.error;

  function reset(forget = false) {
    remote.reset(forget);
    setDemo(null);
    setValidationError('');
  }

  function changeRange(nextFrom: string, nextTo: string, preset: Preset | 'custom') {
    // Demo remains available when exploring its date filters.
    if (!demo) {
      if (validRange(nextFrom, nextTo)) remote.changeRange(nextFrom, nextTo);
      else remote.reset();
    }

    setValidationError('');
    setRange({ from: nextFrom, to: nextTo });
    setSelected(preset);
  }

  function connect(key: string, account: string) {
    setDemo(null);
    setValidationError('');

    if (!validRange(from, to)) {
      remote.reset();
      setValidationError('Choose a past date range of up to 366 days.');

      return;
    }

    remote.connect({ key, account, region: 'auto', from, to });
  }

  return (
    <div className="app-shell">
      <header className="titlebar">
        <Activity size={19} />
        <span>Octopus Saving Session Explorer</span>
      </header>
      <main>
        <section className="intro">
          <div>
            <h1>Saving Session Explorer</h1>
            <p>
              Octopus take a few days to calculate Saving Session results. This tool uses your smart
              meter data to estimate how you did sooner. It can also compare these estimates with
              Octopus Energy’s figures when they arrive. Use it to understand the numbers or spot
              possible missed rewards.
            </p>
            <p>
              Read or contribute to the{' '}
              <a href="https://github.com/rstreefland/saving-session-explorer">code on GitHub</a>.{' '}
              Not affiliated with or endorsed by Octopus Energy.
            </p>
          </div>
        </section>
        <ConnectionForm
          onConnect={connect}
          onForget={() => reset(true)}
          onDemo={() => {
            reset();
            setDemo(demoDataset(true));
            setRange({
              from: todayInLondon().subtract({ days: 30 }).toString(),
              to: todayInLondon().toString(),
            });
            setSelected('custom');
          }}
          busy={remote.busy}
          connected={!demo && remote.data !== null}
          accountNumber={!demo ? remote.data?.accountNumber : undefined}
          accountHolderName={!demo ? remote.data?.accountHolderName : undefined}
          holidayRegion={!demo ? remote.data?.holidayRegion : undefined}
        />
        <section className="workspace">
          <div className="section-heading">
            <h2>Session history</h2>
          </div>
          <DateFilters from={from} to={to} selected={selected} onChange={changeRange} />
          <p className="filter-help">Includes today. All times are UK local time.</p>
          {error && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
          {remote.busy && <LoadingState onCancel={() => reset()} />}
          {demo && <div className="notice demo">Demo account (sample data).</div>}
          {data && (
            <>
              {!data.imports.some(
                (r) => milliseconds(r.interval_end) - milliseconds(r.interval_start) === 1_800_000,
              ) && (
                <div className="notice">
                  <h3>Half-hourly readings are needed</h3>
                  <p>
                    A traditional meter or daily readings cannot measure these sessions. Ask Octopus
                    for a smart meter with half-hourly sharing. If you have one already, its
                    readings may be delayed or missing.
                  </p>
                </div>
              )}
              <SessionHistory
                results={visible}
                type={type}
                onTypeChange={setType}
                summary={<SessionSummary results={visible} type={type} />}
              />
              {(coverage?.missing || warnings.length > 0) && (
                <details className="data-notes">
                  <summary>Meter data notes</summary>
                  {coverage && coverage.missing > 0 && (
                    <p>
                      {coverage.missing} of {coverage.expected} half-hours in this period have
                      missing or invalid readings. Each session is checked separately.
                    </p>
                  )}
                  {warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </details>
              )}
              <p className="fine-print">
                Fetched {formatLocal(data.fetchedAt, { dateStyle: 'short', timeStyle: 'short' })}.
                {data.meterSerials && (
                  <>
                    {' '}
                    Import meter: {data.meterSerials.import}.
                    {data.meterSerials.export && <> Export meter: {data.meterSerials.export}.</>}
                  </>
                )}
                {data.holidayRegion && (
                  <>
                    {' '}
                    Holidays: {data.holidayRegion === 'scotland' ? 'Scotland' : 'England & Wales'} (
                    {data.holidayRegionSource}).
                  </>
                )}{' '}
                Use Refresh results to check again.
              </p>
            </>
          )}
          {!data && !remote.busy && (
            <div className="empty">
              <Activity size={28} />
              <h3>No account loaded</h3>
              <p>Enter your details above, or try the demo.</p>
            </div>
          )}
        </section>
        <Methodology />
      </main>
      <footer>
        <span>Created by Rhys Streefland</span>
        <span>Not affiliated with Octopus Energy.</span>
      </footer>
    </div>
  );
}
