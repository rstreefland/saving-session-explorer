import { useEffect, useState, useRef } from 'react';
import { KeyRound } from 'lucide-react';
import { readKey, saveKey, readAccount, saveAccount, forgetAccount } from '../domain/storage';
export function ConnectionForm({
  onConnect,
  onForget,
  onDemo,
  busy,
  connected = false,
  holidayRegion,
  accountNumber,
  accountHolderName,
}: {
  onConnect: (key: string, account: string) => void;
  onForget: () => void;
  onDemo: () => void;
  busy: boolean;
  connected?: boolean;
  holidayRegion?: string;
  accountNumber?: string;
  accountHolderName?: string | null;
}) {
  const [key, setKey] = useState(readKey),
    [account, setAccount] = useState(readAccount);
  const [error, setError] = useState(''),
    [expanded, setExpanded] = useState(
      () => !(key.trim() && /^A-[A-Za-z0-9]+$/.test(account.trim())),
    );
  const lastConnection = useRef<{ number?: string; name?: string | null; region?: string }>({});
  useEffect(() => {
    if (connected) {
      lastConnection.current = {
        number: accountNumber,
        name: accountHolderName,
        region: holidayRegion,
      };
      setExpanded(false);
    } else if (!busy) setExpanded(true);
  }, [connected, busy, accountNumber, accountHolderName, holidayRegion]);
  function forget() {
    lastConnection.current = {};
    setKey('');
    setAccount('');
    setError('');
    setExpanded(true);
    onForget();
    try {
      forgetAccount();
    } catch (error) {
      setError((error as Error).message);
    }
  }
  const displayRegion = holidayRegion ?? lastConnection.current.region;
  const displayAccount = accountNumber || lastConnection.current.number || account;
  const displayName =
    accountHolderName !== undefined ? accountHolderName : lastConnection.current.name;
  const collapsed = !expanded && (connected || busy);
  const regionLabel =
    displayRegion === 'scotland'
      ? 'Scotland'
      : displayRegion === 'england-and-wales'
        ? 'England & Wales'
        : null;
  return (
    <section
      className={
        'connection panel' +
        (collapsed ? ' connection-collapsed' : '') +
        (busy && collapsed ? ' connection-loading' : '')
      }
      aria-busy={busy}
    >
      {collapsed ? (
        <div className="connection-summary">
          <div className="connection-identity">
            {busy ? (
              <span className="connection-spinner" aria-hidden="true" />
            ) : (
              <KeyRound size={20} />
            )}
            <div>
              <h2>{!connected && busy ? 'Connecting to Octopus' : 'Connected to Octopus'}</h2>
              <p>
                <strong>Account number:</strong> <span>{displayAccount}</span>
              </p>
              {displayName && (
                <p className="account-holder">
                  <strong>Account holder:</strong> <span>{displayName}</span>
                </p>
              )}
              {busy && !connected && (
                <p className="connection-progress" aria-live="polite">
                  Loading your account and sessions…
                </p>
              )}
            </div>
          </div>
          <div className="connection-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => onConnect(key.trim(), account.trim())}
            >
              Refresh results
            </button>
            <button
              type="button"
              className="quiet"
              disabled={busy}
              onClick={() => setExpanded(true)}
            >
              Change account
            </button>
            <button type="button" className="quiet" onClick={forget}>
              Forget account
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="connection-header">
            <KeyRound size={20} />
            <h2>Account</h2>
            <p>
              Your API key and account number are saved in this browser. The key is sent only to
              Octopus.
            </p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setError('');
              try {
                saveKey(key.trim());
                saveAccount(account.trim());
                onConnect(key.trim(), account.trim());
              } catch (error) {
                setError((error as Error).message);
              }
            }}
          >
            <label>
              Octopus API key
              <input
                type="password"
                autoComplete="off"
                required
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk_live_…"
              />
            </label>
            <label>
              Account number
              <input
                required
                pattern="A-[A-Za-z0-9]+"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="A-12345678"
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? 'Loading…' : 'Connect & compare'}
            </button>
            {!connected && (
              <button type="button" className="secondary" disabled={busy} onClick={onDemo}>
                Try demo
              </button>
            )}
            <button type="button" className="quiet" onClick={forget}>
              Forget account
            </button>
          </form>
          {regionLabel && <p className="region-note">Bank holidays: {regionLabel}.</p>}
          <a
            href="https://octopus.energy/dashboard/new/accounts/personal-details/api-access"
            target="_blank"
            rel="noreferrer"
          >
            Get your API key ↗
          </a>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
