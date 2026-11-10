import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StrictMode } from 'react';
import App from './App';
import { todayInLondon, formatDate } from './domain/time';
import { demoDataset } from './domain/demo';

const loadDataset = vi.fn<typeof import('./api/client').loadDataset>();
const user = () => userEvent.setup();

const rows = () =>
  within(screen.getByRole('table', { name: 'Power down session history' }))
    .getAllByRole('row')
    .filter((row) => row.classList.contains('history-row'));

async function credentials() {
  const u = user();

  await u.click(screen.getByRole('button', { name: 'Custom dates' }));
  fireEvent.change(screen.getByLabelText('From'), {
    target: { value: todayInLondon().subtract({ days: 30 }).toString() },
  });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: todayInLondon().toString() } });
  await u.click(screen.getByRole('button', { name: 'Apply dates' }));
  await u.type(screen.getByLabelText('Octopus API key'), 'test-key');
  await u.type(screen.getByLabelText('Account number'), 'A-123');

  return u;
}

const app = () => <App load={loadDataset} />;

describe('Session history', () => {
  it('starts with an accessible connection form', () => {
    render(app());

    expect(screen.getByRole('heading', { name: 'No account loaded' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export evidence' })).not.toBeInTheDocument();
    expect(screen.queryByText('Bank holidays: Detected from your meter.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Octopus API key')).toHaveAttribute('type', 'password');
    expect(screen.queryByLabelText('Show')).not.toBeInTheDocument();

    const account = screen.getByRole('heading', { name: 'Account' }).closest('section')!;

    expect(within(account).getByRole('button', { name: 'Try demo' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('demo supports all three tabs and row details', async () => {
    const u = user();

    render(app());
    await u.click(screen.getByRole('button', { name: 'Try demo' }));

    expect(screen.getByText(/Demo account/)).toBeInTheDocument();
    expect(rows()).toHaveLength(5);
    expect(within(rows()[0]).getByText('Upcoming')).toBeInTheDocument();

    const summary = screen.getByRole('region', { name: 'Session summary' });
    const tabs = screen.getByRole('tablist', { name: 'Session type' });

    expect(tabs.nextElementSibling).toContainElement(summary);
    expect(summary.nextElementSibling).toContainElement(
      screen.getByRole('table', { name: 'Power down session history' }),
    );

    const notes = screen.getByText('Missing data?').closest('details')!;

    expect(notes.previousElementSibling).toContainElement(
      screen.getByRole('table', { name: 'Power down session history' }),
    );
    expect(
      within(summary).getByText('Achieved or partly achieved').nextElementSibling,
    ).toHaveTextContent('3 / 3');

    const changedRow = rows().find((row) => within(row).queryByText('0.64 kWh shifted'))!;

    await u.click(within(changedRow).getByRole('button', { name: /Readings for/ }));

    expect(screen.getByRole('region', { name: 'Calculation summary' })).toBeInTheDocument();

    await u.click(screen.getByRole('tab', { name: 'Power up' }));

    expect(screen.getByRole('table', { name: 'Power up session history' })).toBeInTheDocument();

    await u.click(screen.getByRole('tab', { name: 'Happy Hours' }));

    const table = screen.getByRole('table', { name: 'Happy Hours session history' });

    expect(within(table).getByRole('columnheader', { name: 'Usage' })).toBeInTheDocument();
    expect(within(table.querySelector('tbody')!).getByText('8p')).toBeInTheDocument();
    expect(within(table.querySelector('tfoot')!).getByText('8p')).toBeInTheDocument();
  });

  it('persists a key, loads an account and forgets its results', async () => {
    loadDataset.mockResolvedValue({
      ...demoDataset(),
      accountNumber: 'A-123',
      accountHolderName: 'Test Account Holder',
    });
    render(app());

    const u = await credentials();

    await u.click(screen.getByRole('button', { name: 'Connect & compare' }));
    await waitFor(() => expect(rows()).toHaveLength(4));

    expect(localStorage.getItem('session-lens.api-key')).toBe('test-key');
    expect(localStorage.getItem('session-lens.account-number')).toBe('A-123');
    expect(screen.queryByLabelText('Octopus API key')).not.toBeInTheDocument();

    const accountNumber = screen.getByText('Account number:').closest('p')!;
    const accountHolder = screen.getByText('Account holder:').closest('p')!;

    expect(accountNumber).toHaveTextContent('Account number: A-123');
    expect(accountHolder).toHaveTextContent('Account holder: Test Account Holder');
    expect(accountNumber.nextElementSibling).toBe(accountHolder);

    const summary = screen
      .getByRole('heading', { name: 'Connected to Octopus' })
      .closest('section')!;

    expect(within(summary).queryByText(/Bank holidays:/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change account' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try demo' })).not.toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Change account' }));

    expect(screen.queryByRole('button', { name: 'Try demo' })).not.toBeInTheDocument();
    expect(loadDataset).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'auto', account: 'A-123' }),
      expect.any(AbortSignal),
    );

    await u.click(screen.getByRole('button', { name: 'Forget account' }));

    expect(localStorage.getItem('session-lens.api-key')).toBeNull();
    expect(localStorage.getItem('session-lens.account-number')).toBeNull();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try demo' })).toBeInTheDocument();
  });

  it('loads saved credentials automatically and collapses the account after loading', async () => {
    loadDataset.mockClear().mockResolvedValue(demoDataset());
    localStorage.setItem('session-lens.api-key', 'saved');
    localStorage.setItem('session-lens.account-number', 'A-SAVED');
    render(app());
    await screen.findByRole('table', { name: 'Power down session history' });
    await waitFor(() => expect(screen.queryByLabelText('Octopus API key')).not.toBeInTheDocument());

    expect(loadDataset).toHaveBeenCalledTimes(1);
    expect(loadDataset).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'saved', account: 'A-SAVED', region: 'auto' }),
      expect.any(AbortSignal),
    );
    expect(screen.getByText('Account number:').closest('p')).toHaveTextContent(
      'Account number: A-SAVED',
    );

    await user().click(screen.getByRole('button', { name: 'Forget account' }));

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(loadDataset).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['saved', ''],
    ['', 'A-SAVED'],
    ['saved', 'invalid-account'],
  ])('keeps incomplete or invalid saved credentials editable without fetching', (key, account) => {
    loadDataset.mockClear();

    if (key) localStorage.setItem('session-lens.api-key', key);
    if (account) localStorage.setItem('session-lens.account-number', account);

    render(app());

    expect(screen.getByLabelText('Octopus API key')).toHaveValue(key);
    expect(screen.getByLabelText('Account number')).toHaveValue(account);
    expect(loadDataset).not.toHaveBeenCalled();
  });

  it('lets a saved account retry after an automatic connection fails', async () => {
    localStorage.setItem('session-lens.api-key', 'saved');
    localStorage.setItem('session-lens.account-number', 'A-SAVED');
    loadDataset
      .mockClear()
      .mockRejectedValueOnce(new Error('Octopus is unavailable'))
      .mockResolvedValueOnce(demoDataset());
    render(app());

    expect(await screen.findByRole('alert')).toHaveTextContent('Octopus is unavailable');
    expect(screen.getByLabelText('Octopus API key')).toHaveValue('saved');
    expect(loadDataset).toHaveBeenCalledTimes(1);

    await user().click(screen.getByRole('button', { name: 'Connect & compare' }));
    await screen.findByRole('table', { name: 'Power down session history' });

    expect(loadDataset).toHaveBeenCalledTimes(2);
  });

  it('can cancel automatic loading without reconnecting on a later render', async () => {
    localStorage.setItem('session-lens.api-key', 'saved');
    localStorage.setItem('session-lens.account-number', 'A-SAVED');

    let finish!: (value: ReturnType<typeof demoDataset>) => void;

    loadDataset.mockClear().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(app());

    const u = user();

    expect(screen.getByRole('heading', { name: 'Connecting to Octopus' })).toBeInTheDocument();
    expect(screen.getByText('Account number:').closest('p')).toHaveTextContent(
      'Account number: A-SAVED',
    );
    expect(screen.queryByText(/^Account holder:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Loading account holder name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Octopus API key')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading your sessions');

    await u.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => finish(demoDataset()));
    await u.click(screen.getByRole('button', { name: 'Last 30 days' }));

    expect(loadDataset).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Account number')).toHaveValue('A-SAVED');
  });

  it('loads a saved account under React Strict Mode without getting stuck after cancellation', async () => {
    localStorage.setItem('session-lens.api-key', 'saved');
    localStorage.setItem('session-lens.account-number', 'A-SAVED');
    loadDataset.mockClear().mockResolvedValue(demoDataset());
    render(<StrictMode>{app()}</StrictMode>);
    await screen.findByRole('table', { name: 'Power down session history' });

    expect(
      await screen.findByRole('heading', { name: 'Connected to Octopus' }),
    ).toBeInTheDocument();
    expect(loadDataset.mock.lastCall![1].aborted).toBe(false);
  });

  it('can forget a saved account from the loading summary and discard its late response', async () => {
    localStorage.setItem('session-lens.api-key', 'saved');
    localStorage.setItem('session-lens.account-number', 'A-SAVED');

    let finish!: (value: ReturnType<typeof demoDataset>) => void;

    loadDataset.mockClear().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(app());

    expect(screen.getByRole('heading', { name: 'Connecting to Octopus' })).toBeInTheDocument();

    await user().click(screen.getByRole('button', { name: 'Forget account' }));

    expect(loadDataset.mock.lastCall![1].aborted).toBe(true);

    await act(async () => finish(demoDataset()));

    expect(localStorage.getItem('session-lens.api-key')).toBeNull();
    expect(localStorage.getItem('session-lens.account-number')).toBeNull();
    expect(screen.getByLabelText('Octopus API key')).toHaveValue('');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(loadDataset).toHaveBeenCalledTimes(1);
  });

  it('surfaces API errors and allows retry', async () => {
    loadDataset
      .mockRejectedValueOnce(new Error('Octopus is unavailable'))
      .mockResolvedValueOnce(demoDataset());
    render(app());

    const u = await credentials();

    await u.click(screen.getByRole('button', { name: 'Connect & compare' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Octopus is unavailable');

    await u.click(screen.getByRole('button', { name: 'Connect & compare' }));
    await screen.findByRole('table', { name: 'Power down session history' });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('explains missing half-hourly readings and empty sessions', async () => {
    loadDataset.mockResolvedValue({
      ...demoDataset(),
      sessions: [],
      imports: [],
      warnings: ['Unverified history'],
    });
    render(app());

    const u = await credentials();

    await u.click(screen.getByRole('button', { name: 'Connect & compare' }));

    expect(await screen.findByText('Half-hourly readings are needed')).toBeInTheDocument();
    expect(screen.queryByText(/^Account holder:/)).not.toBeInTheDocument();
    expect(screen.getByText('Account number:').closest('p')).toHaveTextContent(
      'Account number: A-123',
    );
    expect(screen.getByText('No sessions in this view')).toBeInTheDocument();

    await u.click(screen.getByText('Missing data?'));

    expect(screen.getByText('Unverified history')).toBeInTheDocument();
  });

  it('cancels requests and ignores late responses', async () => {
    let finish!: (value: ReturnType<typeof demoDataset>) => void;

    loadDataset.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(app());

    const u = await credentials();

    await u.click(screen.getByRole('button', { name: 'Connect & compare' }));

    expect(screen.getByRole('status')).toHaveTextContent('Loading your sessions');

    await u.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => finish(demoDataset()));

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('uses a date dialog without changing the range until Apply', async () => {
    render(app());

    const u = user();
    const before = screen.getByText(/→/).textContent;

    await u.click(screen.getByRole('button', { name: 'Custom dates' }));

    expect(screen.getByRole('dialog', { name: 'Custom dates' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });

    expect(screen.getByText(/→/)).toHaveTextContent(before!);

    await u.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/→/)).toHaveTextContent(before!);

    await u.click(screen.getByRole('button', { name: 'Custom dates' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-02-01' } });
    await u.click(screen.getByRole('button', { name: 'Apply dates' }));

    expect(screen.getByText('1 Jan 2026 → 1 Feb 2026 (inclusive)')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Last 30 days' }));

    expect(screen.getByRole('button', { name: 'Last 30 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const today = todayInLondon();

    expect(
      screen.getByText(
        `${formatDate(today.subtract({ days: 29 }).toString())} → ${formatDate(today.toString())} (inclusive)`,
      ),
    ).toBeInTheDocument();
  });

  it('rejects invalid custom dates', async () => {
    render(app());

    const u = user();

    await u.click(screen.getByRole('button', { name: 'Custom dates' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2020-01-01' } });

    expect(screen.getByRole('alert')).toHaveTextContent('366 days');
    expect(screen.getByRole('button', { name: 'Apply dates' })).toBeDisabled();
  });

  it('reports unavailable local storage', async () => {
    render(app());

    const u = await credentials();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw Error();
    });
    await u.click(screen.getByRole('button', { name: 'Connect & compare' }));

    expect(screen.getByRole('alert')).toHaveTextContent('storage is unavailable');
  });

  it('aborts on unmount', async () => {
    loadDataset.mockImplementation(() => new Promise(() => {}));

    const view = render(app());
    const u = await credentials();

    await u.click(screen.getByRole('button', { name: 'Connect & compare' }));
    view.unmount();

    expect(loadDataset.mock.lastCall?.[1].aborted).toBe(true);
  });

  it('defaults to last 30 days', async () => {
    loadDataset.mockResolvedValue({ ...demoDataset(), sessions: [] });
    render(app());

    const u = user();

    expect(screen.queryByRole('button', { name: 'Last 7 days' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last 30 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await u.type(screen.getByLabelText('Octopus API key'), 'test-key');
    await u.type(screen.getByLabelText('Account number'), 'A-123');
    await u.click(screen.getByRole('button', { name: 'Connect & compare' }));
    await screen.findByText('No sessions in this view');

    const today = todayInLondon();

    await waitFor(() =>
      expect(loadDataset).toHaveBeenLastCalledWith(
        expect.objectContaining({
          from: today.subtract({ days: 29 }).toString(),
          to: today.toString(),
        }),
        expect.any(AbortSignal),
      ),
    );
  });
});

it('disconnects and aborts a refresh even when saved details cannot be removed', async () => {
  loadDataset.mockResolvedValueOnce(demoDataset());
  render(app());

  const u = await credentials();

  await u.click(screen.getByRole('button', { name: 'Connect & compare' }));
  await screen.findByRole('button', { name: 'Refresh results' });
  loadDataset.mockImplementationOnce(() => new Promise(() => {}));
  await u.click(screen.getByRole('button', { name: 'Refresh results' }));

  const signal = loadDataset.mock.lastCall![1];

  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw Error();
  });
  await u.click(screen.getByRole('button', { name: 'Forget account' }));

  expect(signal.aborted).toBe(true);
  expect(screen.getByRole('heading', { name: 'No account loaded' })).toBeInTheDocument();
  expect(screen.getByLabelText('Octopus API key')).toHaveValue('');
  expect(screen.getByLabelText('Account number')).toHaveValue('');
  expect(screen.getByRole('alert')).toHaveTextContent('saved details could not be removed');
});

it('filters and orders sessions before passing them to the history table', async () => {
  const data = demoDataset(true);

  data.sessions.reverse();
  loadDataset.mockResolvedValueOnce(data);
  render(app());

  const u = await credentials();

  await u.click(screen.getByRole('button', { name: 'Connect & compare' }));
  await screen.findByRole('button', { name: 'Refresh results' });

  const dates = Array.from(document.querySelectorAll('.history-row time')).map((time) =>
    time.getAttribute('datetime'),
  );

  expect(dates).toEqual(
    data.sessions
      .filter((session) => session.eventType === 'TURN_DOWN')
      .map((session) => session.startAt)
      .sort((a, b) => Date.parse(b) - Date.parse(a)),
  );
});
