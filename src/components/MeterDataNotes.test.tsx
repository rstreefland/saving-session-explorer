import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { MeterDataNotes } from './MeterDataNotes';

it('shows one row per contiguous period with full, partial or absent Mini data', async () => {
  render(
    <MeterDataNotes
      coverage={{
        expected: 100,
        missing: 10,
        gaps: [
          {
            status: 'pending',
            start: '2026-11-04T00:00:00Z',
            end: '2026-11-05T10:30:00Z',
            count: 69,
            meters: 'import',
            homeMiniCount: 69,
          },
          {
            status: 'pending',
            start: '2026-11-05T11:00:00Z',
            end: '2026-11-05T12:00:00Z',
            count: 2,
            meters: 'import',
            homeMiniCount: 1,
          },
          {
            status: 'pending',
            start: '2026-11-05T13:00:00Z',
            end: '2026-11-05T13:30:00Z',
            count: 1,
            meters: 'import',
            homeMiniCount: 0,
          },
        ],
      }}
      warnings={['Example warning']}
    />,
  );
  await userEvent.click(screen.getByText('Missing data?'));
  const table = screen.getByRole('table', { name: 'Missing meter readings' });
  const rows = within(table).getAllByRole('row');
  expect(rows).toHaveLength(4);
  expect(rows[1]).toHaveTextContent('4 Nov 2026');
  expect(within(rows[1]).getAllByRole('cell').at(-2)).toHaveTextContent('Pending');
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent),
  ).toEqual(['From', 'To', 'Status', 'Home Mini data available']);
  expect(rows[1]).toHaveTextContent('5 Nov 2026');
  expect(within(rows[1]).getAllByRole('cell').at(-1)).toHaveTextContent('Yes');
  expect(within(rows[2]).getAllByRole('cell').at(-1)).toHaveTextContent('Partial');
  expect(within(rows[3]).getAllByRole('cell').at(-1)).toHaveTextContent('No');
  expect(screen.getByText('Example warning')).toBeVisible();
});

it('does not imply Mini import readings fill missing export data', async () => {
  render(
    <MeterDataNotes
      coverage={{
        expected: 1,
        missing: 1,
        gaps: [
          {
            status: 'pending',
            start: '2026-11-05T00:00:00Z',
            end: '2026-11-05T00:30:00Z',
            count: 1,
            meters: 'import and export',
            homeMiniCount: 1,
          },
        ],
      }}
      warnings={[]}
    />,
  );
  await userEvent.click(screen.getByText('Missing data?'));
  expect(screen.getByRole('cell', { name: 'Partial (import only)' })).toBeVisible();
});
