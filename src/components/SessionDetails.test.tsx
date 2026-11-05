import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { SessionDetails } from './SessionDetails';
import { calculateAll } from '../domain/calculate';
import { demoDataset } from '../domain/demo';

function mixed(first: number, second: number, up = false) {
  const data = demoDataset();
  const session = data.sessions[1];
  session.eventType = up ? 'TURN_UP' : 'TURN_DOWN';
  const start = Date.parse(session.startAt);
  for (const reading of data.imports) {
    const offset = (Date.parse(reading.interval_start) - start) / 1_800_000;
    if (offset === 0) reading.consumption = first;
    if (offset === 1) reading.consumption = second;
  }
  return calculateAll(data)[1];
}

it('explains the overall result and separately adds the rewarded half-hours', () => {
  render(<SessionDetails result={mixed(0.1, 0.7)} />);
  const summary = screen.getByRole('region', { name: 'Calculation summary' });
  expect(within(summary).getByText('Achieved')).toBeInTheDocument();
  expect(summary).toHaveTextContent(
    'You used 0.400 kWh less than baseline over the whole session.',
  );
  const equation = within(summary).getByRole('group', {
    name: 'Baseline minus your usage equals overall change',
  });
  const figures = within(equation).getAllByRole('definition');
  expect(figures[0]).toHaveTextContent('1.200 kWh');
  expect(figures[1]).toHaveTextContent('0.800 kWh');
  expect(figures[2]).toHaveTextContent('0.400 kWh');
  expect(within(equation).getByText('−')).toBeVisible();
  expect(within(equation).getByText('=')).toBeVisible();
  const table = screen.getByRole('table', { name: 'Half-hour readings (kWh)' });
  const rows = within(table).getAllByRole('row');
  expect(rows[1]).toHaveTextContent('0.6000.1000.500');
  expect(rows[2]).toHaveTextContent('0.6000.7000.000');
  expect(rows[3]).toHaveTextContent('Total shifted for rewards0.500');
  expect(screen.queryByRole('table', { name: 'Usage comparison' })).not.toBeInTheDocument();
  expect(
    screen.queryByRole('table', { name: 'Readings used for baseline' }),
  ).not.toBeInTheDocument();
});

it('explains why a partly achieved session can still earn rewards', () => {
  render(<SessionDetails result={mixed(0.1, 1.2)} />);
  const summary = screen.getByRole('region', { name: 'Calculation summary' });
  expect(summary).toHaveTextContent('Partly achieved');
  expect(summary).toHaveTextContent('Those half-hours still count towards rewards.');
  expect(summary).toHaveTextContent('More than baseline');
  const equation = within(summary).getByRole('group', {
    name: 'Baseline minus your usage equals overall change',
  });
  expect(within(equation).getAllByRole('definition')[2]).toHaveTextContent('-0.100 kWh');
});

it('reverses the comparison for Power up without counting negative shifts as rewards', () => {
  render(<SessionDetails result={mixed(1.1, 0.5, true)} />);
  const summary = screen.getByRole('region', { name: 'Calculation summary' });
  expect(summary).toHaveTextContent(
    'You used 0.400 kWh more than baseline over the whole session.',
  );
  const equation = within(summary).getByRole('group', {
    name: 'Your usage minus baseline equals overall change',
  });
  const figures = within(equation).getAllByRole('definition');
  expect(figures[0]).toHaveTextContent('1.600 kWh');
  expect(figures[1]).toHaveTextContent('1.200 kWh');
  expect(figures[2]).toHaveTextContent('0.400 kWh');
  expect(screen.getByRole('table', { name: 'Half-hour readings (kWh)' })).toHaveTextContent(
    'Total shifted for rewards0.500',
  );
});

it.each([
  [0.1, 1.2, false, true],
  [1.1, 0.5, true, true],
  [0.1, 0.7, false, false],
  [0.1, 1.1, false, false],
] as const)(
  'marks an overall increase above baseline regardless of session type (%s, %s, Power up: %s)',
  (first, second, up, overBaseline) => {
    render(<SessionDetails result={mixed(first, second, up)} />);
    const card = screen
      .getByText('Overall change', { selector: 'dt' })
      .closest('.calculation-card')!;
    if (overBaseline) {
      expect(card).toHaveClass('calculation-card-over-baseline');
      expect(card).toHaveTextContent('More than baseline');
    } else expect(card).not.toHaveClass('calculation-card-over-baseline');
  },
);

it.each([false, true])(
  'explains an unsuccessful session in the correct direction (Power up: %s)',
  (up) => {
    render(<SessionDetails result={up ? mixed(0.2, 0.3, true) : mixed(0.8, 0.7)} />);
    expect(screen.getByRole('region', { name: 'Calculation summary' })).toHaveTextContent(
      `You did not use ${up ? 'more' : 'less'} than baseline in any half-hour.`,
    );
  },
);

it('shows missing readings explicitly without implying a zero or a complete estimate', () => {
  render(<SessionDetails result={calculateAll(demoDataset())[3]} />);
  const summary = screen.getByRole('region', { name: 'Calculation summary' });
  expect(summary).toHaveTextContent('Awaiting meter readings');
  expect(summary).toHaveTextContent('This calculation cannot be completed yet.');
  expect(screen.getByRole('heading', { name: 'What’s missing' })).toBeInTheDocument();
  const table = screen.getByRole('table', { name: 'Half-hour readings (kWh)' });
  expect(within(table).getAllByText('•••')).toHaveLength(3);
  expect(table).toHaveTextContent('•••');
});

it('shows Happy Hour imported usage without a baseline or a promise of bill credit', async () => {
  const result = calculateAll(demoDataset(true)).find(
    (r) => r.session.eventType === 'WEEKEND_HAPPY_HOUR',
  )!;
  render(<SessionDetails result={result} />);
  const summary = screen.getByRole('region', { name: 'Calculation summary' });
  expect(summary).toHaveTextContent('No baseline comparison is needed.');
  expect(summary).toHaveTextContent('0.300 kWh');
  expect(within(summary).getByRole('group', { name: 'Metered usage' })).toBeInTheDocument();
  expect(within(summary).queryByText('−')).not.toBeInTheDocument();
  expect(within(summary).queryByText('=')).not.toBeInTheDocument();
  expect(screen.queryByText(/Days used for baseline/)).not.toBeInTheDocument();
  const table = screen.getByRole('table', { name: 'Half-hour readings (kWh)' });
  expect(within(table).getAllByRole('columnheader')).toHaveLength(2);
  expect(table).toHaveTextContent('Total imported0.300');
  await userEvent.click(screen.getByText('Compare with Octopus'));
  expect(
    screen.queryByRole('complementary', { name: 'Why the kWh figures can differ' }),
  ).not.toBeInTheDocument();
});

it('shows the actual reference dates and lets the user inspect each half-hour separately', async () => {
  const result = calculateAll(demoDataset())[1];
  result.slots[0].references[0].value = 0.123;
  result.slots[1].references[0].value = 0.456;
  render(<SessionDetails result={result} />);
  const user = userEvent.setup();
  await user.click(screen.getByText(/Days used for baseline/));
  const table = screen.getByRole('table', { name: 'Readings used for baseline' });
  expect(within(table).getByText('0.123')).toBeInTheDocument();
  expect(within(table).getAllByRole('row')).toHaveLength(result.days.length + 2);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Half-hour to inspect' }), '1');
  expect(within(table).getByText('0.456')).toBeInTheDocument();
  expect(within(table).queryByText('0.123')).not.toBeInTheDocument();
  expect(table).toHaveTextContent('Average for this half-hour0.600');
});

it('explains missing reference readings instead of averaging only the remaining days', async () => {
  const data = demoDataset();
  const before = calculateAll(data)[1];
  data.imports = data.imports.filter(
    (reading) => !reading.interval_start.startsWith(before.days[0]),
  );
  render(<SessionDetails result={calculateAll(data)[1]} />);
  await userEvent.click(screen.getByText(/Days used for baseline/));
  const table = screen.getByRole('table', { name: 'Readings used for baseline' });
  expect(within(table).getAllByText('•••')).toHaveLength(2);
  expect(
    screen.getByText(
      /This half-hour’s average cannot be calculated while a reference reading is missing/,
    ),
  ).toBeVisible();
});

it('keeps Octopus figures and neutral differences inside their own disclosure', async () => {
  render(<SessionDetails result={calculateAll(demoDataset())[1]} />);
  expect(screen.queryByRole('table', { name: 'Usage comparison' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByText('Compare with Octopus'));
  expect(screen.getByRole('table', { name: 'Usage comparison' })).toHaveTextContent(
    'Shifted for rewards0.9000.640',
  );
  expect(screen.getByText(/Difference in shifted energy: \+0.260 kWh/)).toBeVisible();
  const explanation = screen.getByRole('complementary', { name: 'Why the kWh figures can differ' });
  expect(explanation).toHaveTextContent(
    'Octopus appears to round the reward before converting it back into kWh',
  );
  expect(explanation).toHaveTextContent(
    'The exact formula could not be confirmed because it has not been published by Octopus',
  );
});

it('explains an empty reference history without displaying a made-up average', async () => {
  const data = demoDataset();
  const start = Date.parse(data.sessions[1].startAt);
  data.eventDays = Array.from({ length: 60 }, (_, i) =>
    new Date(start - (i + 1) * 86_400_000).toISOString().slice(0, 10),
  );
  render(<SessionDetails result={calculateAll(data)[1]} />);
  expect(screen.getByRole('region', { name: 'Calculation summary' })).toHaveTextContent(
    'Not enough history',
  );
  await userEvent.click(screen.getByText('Days used for baseline (0)'));
  expect(screen.getByText('No eligible reference days are available.')).toBeVisible();
  expect(
    screen.queryByRole('table', { name: 'Readings used for baseline' }),
  ).not.toBeInTheDocument();
});

it('uses the same numeric placeholder for pending supplier figures and missing readings', async () => {
  const results = calculateAll(demoDataset());
  const view = render(<SessionDetails result={results[0]} />);
  await userEvent.click(screen.getByText('Compare with Octopus'));
  expect(
    within(screen.getByRole('table', { name: 'Usage comparison' })).getAllByText('•••'),
  ).toHaveLength(3);
  view.rerender(
    <SessionDetails
      result={{
        ...results[0],
        session: { ...results[0].session, resultsStatus: 'MISSING_READINGS' },
      }}
    />,
  );
  expect(
    within(screen.getByRole('table', { name: 'Usage comparison' })).getAllByText('•••'),
  ).toHaveLength(3);
});
