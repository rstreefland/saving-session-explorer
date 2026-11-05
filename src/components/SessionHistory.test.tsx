import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { SessionHistory } from './SessionHistory';
import { calculateAll } from '../domain/calculate';
import { demoDataset } from '../domain/demo';
import type { SessionType } from '../domain/session';

it('uses Octopus status descriptions and preserves zero, missing and pending results', async () => {
  const data = demoDataset(),
    base = data.sessions[0];
  data.sessions = ['SUCCESS', 'PARTIAL_SUCCESS', 'FAIL', 'MISSING_READINGS', 'CALCULATING'].map(
    (resultsStatus, i) => ({
      ...base,
      eventId: 10 + i,
      resultsStatus,
      energyDeltaKwh: 0,
      rewardGivenInOctoPoints: 0,
    }),
  );
  render(<SessionHistory results={calculateAll(data)} type="TURN_DOWN" onTypeChange={vi.fn()} />);
  const table = screen.getByRole('table', { name: 'Power down session history' });
  expect(within(table).getAllByRole('columnheader')).toHaveLength(6);
  expect(within(table).queryByRole('img')).not.toBeInTheDocument();
  expect(within(table).queryByRole('columnheader', { name: /Shifted/ })).not.toBeInTheDocument();
  const officialCells = within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1].querySelector('.result-summary')!);
  expect(officialCells.map((cell) => cell.textContent)).toEqual([
    'Achieved0.00 kWh shifted',
    'Partly achieved0.00 kWh shifted',
    'Not achieved0.00 kWh shifted',
    'Missing readings•••',
    'Pending•••',
  ]);
  expect(within(table).getAllByRole('cell', { name: '0 Octopoints' })).toHaveLength(4);
});
it('supports keyboard navigation between the three tabs', () => {
  function History() {
    const [type, setType] = useState<SessionType>('TURN_DOWN');
    return <SessionHistory results={[]} type={type} onTypeChange={setType} />;
  }
  render(<History />);
  const down = screen.getByRole('tab', { name: 'Power down' });
  down.focus();
  fireEvent.keyDown(down, { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Power up' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Power up' }), { key: 'End' });
  expect(screen.getByRole('tab', { name: 'Happy Hours' })).toHaveFocus();
  expect(screen.getByRole('columnheader', { name: 'Usage' })).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Happy Hours' }), { key: 'Home' });
  expect(down).toHaveFocus();
});
it('expands and collapses reading details per row', async () => {
  const result = calculateAll(demoDataset())[0];
  render(<SessionHistory results={[result]} type="TURN_DOWN" onTypeChange={vi.fn()} />);
  const button = screen.getByRole('button', { name: /Readings for/ });
  const row = button.closest('tr')!;
  expect(button.closest('td')).toBe(row.lastElementChild);
  expect(within(row).getByRole('rowheader')).not.toContainElement(button);
  expect(button.textContent).toBe('');
  await userEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('table', { name: 'Half-hour readings (kWh)' })).toBeInTheDocument();
  expect(
    document.getElementById(button.getAttribute('aria-controls')!)?.querySelector('td'),
  ).toHaveAttribute('colspan', '6');
  await userEvent.keyboard(' ');
  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(button).toHaveFocus();
  expect(screen.queryByRole('table', { name: 'Half-hour readings (kWh)' })).not.toBeInTheDocument();
});

it('labels Octopus results and names the reason a comparison is unavailable', () => {
  const data = demoDataset();
  const result = calculateAll(data)[3];
  render(<SessionHistory results={[result]} type="TURN_DOWN" onTypeChange={vi.fn()} />);
  expect(screen.getByRole('columnheader', { name: 'Result' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Calculated result' })).toBeInTheDocument();
  expect(screen.queryByText('Meter readings')).not.toBeInTheDocument();
  expect(screen.getByText('Awaiting meter readings')).toBeInTheDocument();
  expect(screen.queryByText('Incomplete')).not.toBeInTheDocument();
});
it('identifies the official result and reward through their header tooltips', async () => {
  render(<SessionHistory results={[]} type="TURN_DOWN" onTypeChange={vi.fn()} />);
  const user = userEvent.setup();
  const estimateHelp = screen.getByRole('button', { name: 'Calculated result' });
  await user.click(estimateHelp);
  expect(estimateHelp).toHaveAccessibleDescription(
    'Estimated figures produced by looking at your smart meter data. May differ to the actual figures from Octopus Energy.',
  );
  await user.keyboard('{Escape}');
  const result = screen.getByRole('columnheader', { name: 'Result' });
  const reward = screen.getByRole('columnheader', { name: 'Reward' });
  expect(result).not.toHaveTextContent('Octopus');
  expect(reward).not.toHaveTextContent('Octopus');
  const resultHelp = within(result).getByRole('button', { name: 'Result' });
  await user.click(resultHelp);
  expect(resultHelp).toHaveAccessibleDescription('Actual figures from Octopus Energy.');
  await user.keyboard('{Escape}');
  const rewardHelp = within(reward).getByRole('button', { name: 'Reward' });
  await user.click(rewardHelp);
  expect(rewardHelp).toHaveAccessibleDescription('Actual figures from Octopus Energy.');
});
it('does not call missing calendar or baseline history a meter-reading delay', () => {
  const data = demoDataset();
  data.baselineIssues = ['event-history'];
  const result = calculateAll(data)[0];
  const view = render(
    <SessionHistory results={[result]} type="TURN_DOWN" onTypeChange={vi.fn()} />,
  );
  expect(screen.getByText('Awaiting session history')).toBeInTheDocument();
  expect(screen.queryByText('Awaiting meter readings')).not.toBeInTheDocument();
  view.rerender(
    <SessionHistory
      results={[{ ...result, unavailableReason: 'baseline-history' }]}
      type="TURN_DOWN"
      onTypeChange={vi.fn()}
    />,
  );
  expect(screen.getByText('Not enough history')).toBeInTheDocument();
});

it('shows neutral small differences only in details and flags genuinely missing rewards', async () => {
  const result = calculateAll(demoDataset())[1];
  const view = render(
    <SessionHistory
      results={[{ ...result, difference: -0.018, state: 'difference' }]}
      type="TURN_DOWN"
      onTypeChange={vi.fn()}
    />,
  );
  expect(screen.queryByText('Check readings')).not.toBeInTheDocument();
  expect(screen.queryByText(/Possible missed reward/)).not.toBeInTheDocument();
  expect(screen.getAllByText('Achieved')).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: /Readings for/ }));
  expect(screen.queryByRole('table', { name: 'Usage comparison' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByText('Compare with Octopus'));
  expect(screen.getByText(/Difference in shifted energy: -0.018 kWh/)).toBeVisible();
  view.rerender(
    <SessionHistory
      results={[
        {
          ...result,
          session: { ...result.session, resultsStatus: 'FAIL', rewardGivenInOctoPoints: 0 },
        },
      ]}
      type="TURN_DOWN"
      onTypeChange={vi.fn()}
    />,
  );
  expect(screen.getAllByText(/Possible missed reward/).length).toBeGreaterThan(0);
});
it('preserves the row order supplied by the parent', () => {
  const results = calculateAll(demoDataset()).reverse();
  render(<SessionHistory results={results} type="TURN_DOWN" onTypeChange={vi.fn()} />);
  const dates = Array.from(document.querySelectorAll('.history-row time')).map((time) =>
    time.getAttribute('datetime'),
  );
  expect(dates).toEqual(results.map((r) => r.session.startAt));
});
it('shows a failed zero result as final rather than awaiting Octopus', () => {
  const result = calculateAll(demoDataset())[1];
  render(
    <SessionHistory
      results={[
        {
          ...result,
          rewarded: 0,
          session: {
            ...result.session,
            resultsStatus: 'FAIL',
            energyDeltaKwh: null,
            rewardGivenInOctoPoints: 0,
          },
        },
      ]}
      type="TURN_DOWN"
      onTypeChange={vi.fn()}
    />,
  );
  expect(screen.getAllByText('0.00 kWh shifted')).toHaveLength(2);
  const outcomes = screen.getAllByText('Not achieved');
  expect(outcomes).toHaveLength(2);
  outcomes.forEach((outcome) => expect(outcome).toHaveClass('outcome-negative'));
  expect(screen.queryByText('Awaiting Octopus')).not.toBeInTheDocument();
});

it('shows calculated and actual rewards independently, including before Octopus publishes', async () => {
  const result = calculateAll(demoDataset())[0];
  render(<SessionHistory results={[result]} type="TURN_DOWN" onTypeChange={vi.fn()} />);
  expect(screen.getByRole('columnheader', { name: 'Calculated reward' })).toBeInTheDocument();
  const row = screen.getByRole('button', { name: /Readings for/ }).closest('tr')!;
  const cells = within(row).getAllByRole('cell');
  expect(cells[2]).toHaveTextContent('72 Octopoints');
  expect(cells[3]).toHaveTextContent('•••');
  expect(row.querySelector('.mobile-reward')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Calculated reward' }));
  expect(screen.getByRole('tooltip')).toHaveTextContent(
    'Estimated Octopoints from shifted energy and the session rate.',
  );
});
it('does not mistake a Power up placeholder rate for a zero-point reward', () => {
  const result = calculateAll(demoDataset(true)).find((r) => r.session.eventType === 'TURN_UP')!;
  render(<SessionHistory results={[result]} type="TURN_UP" onTypeChange={vi.fn()} />);
  const cells = within(
    screen.getByRole('button', { name: /Readings for/ }).closest('tr')!,
  ).getAllByRole('cell');
  expect(cells[2]).toHaveTextContent('•••');
  expect(cells[3]).toHaveTextContent('0 Octopoints');
});
it('keeps Happy Hour cash credits without an estimated Octopoints column', async () => {
  const result = calculateAll(demoDataset(true)).find(
    (r) => r.session.eventType === 'WEEKEND_HAPPY_HOUR',
  )!;
  render(<SessionHistory results={[result]} type="WEEKEND_HAPPY_HOUR" onTypeChange={vi.fn()} />);
  expect(screen.queryByRole('columnheader', { name: 'Calculated reward' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('columnheader')).toHaveLength(5);
  const button = screen.getByRole('button', { name: /Readings for/ });
  expect(button.closest('tr')?.querySelector('.reward-cell')).toHaveTextContent('8p');
  await userEvent.click(button);
  expect(
    document.getElementById(button.getAttribute('aria-controls')!)?.querySelector('td'),
  ).toHaveAttribute('colspan', '5');
});

it('puts rewards below their corresponding results on mobile and adapts expanded rows on resize', async () => {
  const media = Object.assign(new EventTarget(), { matches: true });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  );
  const remove = vi.spyOn(media, 'removeEventListener');
  const result = calculateAll(demoDataset())[1];
  const view = render(
    <SessionHistory results={[result]} type="TURN_DOWN" onTypeChange={vi.fn()} />,
  );
  const table = screen.getByRole('table');
  expect(within(table).getAllByRole('columnheader')).toHaveLength(4);
  expect(screen.queryByRole('columnheader', { name: 'Calculated reward' })).not.toBeInTheDocument();
  const button = screen.getByRole('button', { name: /Readings for/ });
  const cells = within(button.closest('tr')!).getAllByRole('cell');
  expect(cells).toHaveLength(3);
  expect(cells[0].querySelector('.mobile-reward')).toHaveTextContent('Octopoints72 Octopoints');
  expect(cells[1].querySelector('.mobile-reward')).toHaveTextContent('Octopoints72 Octopoints');
  await userEvent.click(button);
  const details = document.getElementById(button.getAttribute('aria-controls')!)!;
  expect(details.querySelector('td')).toHaveAttribute('colspan', '4');
  act(() => {
    media.matches = false;
    media.dispatchEvent(new Event('change'));
  });
  expect(within(table.querySelector('thead')!).getAllByRole('columnheader')).toHaveLength(6);
  expect(details.querySelector('td')).toHaveAttribute('colspan', '6');
  expect(button.closest('tr')?.querySelector('.mobile-reward')).toBeNull();
  view.unmount();
  expect(remove).toHaveBeenCalledWith('change', expect.any(Function));
});

it('labels Happy Hour cash credits correctly in the compact table', () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => Object.assign(new EventTarget(), { matches: true })),
  );
  const result = calculateAll(demoDataset(true)).find(
    (r) => r.session.eventType === 'WEEKEND_HAPPY_HOUR',
  )!;
  render(<SessionHistory results={[result]} type="WEEKEND_HAPPY_HOUR" onTypeChange={vi.fn()} />);
  const row = screen.getByRole('button', { name: /Readings for/ }).closest('tr')!;
  expect(row.querySelector('.mobile-reward')).toHaveTextContent('Bill credit8p');
  expect(within(row).queryByText('Octopoints')).not.toBeInTheDocument();
});

it.each([0, 3])('shows a consistent placeholder for unavailable shifted figures (%s)', (index) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => Object.assign(new EventTarget(), { matches: true })),
  );
  const result = calculateAll(demoDataset())[index];
  render(<SessionHistory results={[result]} type="TURN_DOWN" onTypeChange={vi.fn()} />);
  const row = screen.getByRole('button', { name: /Readings for/ }).closest('tr')!;
  const cells = within(row).getAllByRole('cell');
  const unknown = cells[index === 0 ? 1 : 0];
  const placeholder = unknown.querySelector('.shifted-energy');
  expect(placeholder).toBeInTheDocument();
  expect(placeholder).toHaveTextContent('•••');
  expect(placeholder).toBeVisible();
  expect(unknown).not.toHaveAccessibleName(/0\.00 kWh/);
  expect(cells[index === 0 ? 0 : 1].querySelector('.shifted-energy')).toBeVisible();
});

it.each([
  ['2026-11-05T00:00:00Z', '2026-11-05T01:00:00Z', '12–1am', '12am – 1am'],
  ['2026-11-05T14:00:00Z', '2026-11-05T15:00:00Z', '2–3pm', '2pm – 3pm'],
  ['2026-11-05T16:30:00Z', '2026-11-05T17:30:00Z', '4:30–5:30pm', '4:30pm – 5:30pm'],
  ['2026-11-05T11:30:00Z', '2026-11-05T12:30:00Z', '11:30am–12:30pm', '11:30am – 12:30pm'],
  ['2026-11-05T09:30:00Z', '2026-11-05T10:30:00Z', '9:30–10:30am', '9:30am – 10:30am'],
])('uses a compact, unambiguous time range on mobile (%s)', (startAt, endAt, visible, spoken) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => Object.assign(new EventTarget(), { matches: true })),
  );
  const result = calculateAll(demoDataset())[0];
  result.session = { ...result.session, startAt, endAt };
  render(<SessionHistory results={[result]} type="TURN_DOWN" onTypeChange={vi.fn()} />);
  const date = screen.getByRole('rowheader');
  expect(within(date).getByText(visible)).toHaveAttribute('aria-hidden', 'true');
  expect(within(date).getByText(spoken)).toHaveClass('sr-only');
  expect(date).toHaveAccessibleName(new RegExp(spoken));
});
