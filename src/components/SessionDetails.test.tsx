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

it('shows half-hour formulas and the rewarded total without an overall-change summary', () => {
  render(<SessionDetails result={mixed(0.1, 0.7)} />);

  const summary = screen.getByRole('region', { name: 'Calculation summary' });
  const equations = within(summary).getAllByRole('group', {
    name: 'Baseline minus your usage equals change',
  });

  expect(equations).toHaveLength(2);
  expect(within(summary).getByRole('heading', { name: '5:00pm – 5:30pm' })).toBeVisible();
  expect(within(summary).getByRole('heading', { name: '5:30pm – 6:00pm' })).toBeVisible();
  expect(
    within(equations[0])
      .getAllByRole('definition')
      .map((value) => value.textContent),
  ).toEqual(['0.600 kWh', '0.100 kWh', '0.500 kWh0.500 kWh counts towards rewards']);
  expect(
    within(equations[1])
      .getAllByRole('definition')
      .map((value) => value.textContent),
  ).toEqual(['0.600 kWh', '0.700 kWh', '-0.100 kWh0.000 kWh counts towards rewards']);
  for (const equation of equations) {
    expect(within(equation).getByText('−')).toBeVisible();
    expect(within(equation).getByText('=')).toBeVisible();
  }
  expect(summary).toHaveTextContent('Total shifted for rewards0.500 kWh');
  expect(within(summary).queryByText('Overall change')).not.toBeInTheDocument();
  expect(within(summary).queryByText('Achieved')).not.toBeInTheDocument();
  expect(screen.queryByRole('table', { name: 'Half-hour readings (kWh)' })).not.toBeInTheDocument();
});

it('uses rewarded half-hours rather than the net session reduction in the screenshot example', () => {
  const result = mixed(0.196, 0.125);

  result.slots[0].baseline = 0.194;
  result.slots[1].baseline = 0.202;
  Object.assign(result, { baseline: 0.396, actual: 0.321, netSaved: 0.075, rewarded: 0.077 });
  render(<SessionDetails result={result} />);

  const summary = screen.getByRole('region', { name: 'Calculation summary' });

  expect(summary).toHaveTextContent('-0.002 kWh0.000 kWh counts towards rewards');
  expect(summary).toHaveTextContent('0.077 kWh counts towards rewards');
  expect(summary).toHaveTextContent('Total shifted for rewards0.077 kWh');
  expect(summary).not.toHaveTextContent('0.075');
});

it('retains earned shifts when usage rises over the session as a whole', () => {
  render(<SessionDetails result={mixed(0.1, 1.2)} />);

  const summary = screen.getByRole('region', { name: 'Calculation summary' });

  expect(summary).toHaveTextContent('0.500 kWh counts towards rewards');
  expect(summary).toHaveTextContent('-0.600 kWh0.000 kWh counts towards rewards');
  expect(summary).toHaveTextContent('Total shifted for rewards0.500 kWh');
});

it('reverses the formula for Power up and counts only usage above baseline', () => {
  render(<SessionDetails result={mixed(1.1, 0.5, true)} />);

  const summary = screen.getByRole('region', { name: 'Calculation summary' });
  const equations = within(summary).getAllByRole('group', {
    name: 'Your usage minus baseline equals change',
  });

  expect(
    within(equations[0])
      .getAllByRole('definition')
      .map((value) => value.textContent),
  ).toEqual(['1.100 kWh', '0.600 kWh', '0.500 kWh0.500 kWh counts towards rewards']);
  expect(
    within(equations[1])
      .getAllByRole('definition')
      .map((value) => value.textContent),
  ).toEqual(['0.500 kWh', '0.600 kWh', '-0.100 kWh0.000 kWh counts towards rewards']);
  expect(summary).toHaveTextContent('Total shifted for rewards0.500 kWh');
});

it.each([false, true])('shows zero when no half-hour qualifies (Power up: %s)', (up) => {
  render(<SessionDetails result={up ? mixed(0.2, 0.3, true) : mixed(0.8, 0.7)} />);

  const summary = screen.getByRole('region', { name: 'Calculation summary' });

  expect(within(summary).getAllByText('0.000 kWh counts towards rewards')).toHaveLength(2);
  expect(summary).toHaveTextContent('Total shifted for rewards0.000 kWh');
});

it('shows missing readings as placeholders without producing a complete total', () => {
  render(<SessionDetails result={calculateAll(demoDataset())[3]} />);

  const summary = screen.getByRole('region', { name: 'Calculation summary' });

  expect(summary).toHaveTextContent('This estimate is incomplete.');
  expect(within(summary).getByText('Awaiting readings')).toBeVisible();
  expect(summary).toHaveTextContent('Total shifted for rewards•••');
  expect(screen.getByRole('heading', { name: 'What’s missing' })).toBeVisible();
});

it('adds Happy Hour import readings without baseline equations or a promise of credit', async () => {
  const result = calculateAll(demoDataset(true)).find(
    (r) => r.session.eventType === 'WEEKEND_HAPPY_HOUR',
  )!;

  render(<SessionDetails result={result} />);

  const summary = screen.getByRole('region', { name: 'Calculation summary' });
  const readings = within(summary).getAllByRole('group', { name: 'Imported usage' });

  expect(readings).toHaveLength(2);
  expect(readings[0]).toHaveTextContent('Imported0.150 kWh');
  expect(summary).toHaveTextContent('Total imported0.300 kWh');
  expect(summary).toHaveTextContent('No baseline comparison is needed.');
  expect(within(summary).queryByText('−')).not.toBeInTheDocument();
  expect(screen.queryByText(/Days used for baseline/)).not.toBeInTheDocument();
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

  expect(screen.getByRole('option', { name: '5:00pm – 5:30pm' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '5:30pm – 6:00pm' })).toBeInTheDocument();
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
    'This estimate is incomplete.',
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

it('explains provisional Mini inputs without suggesting a missed reward', async () => {
  const result = mixed(0.1, 0.1);
  render(
    <SessionDetails
      result={{
        ...result,
        provisional: true,
        session: { ...result.session, resultsStatus: 'FAIL', rewardGivenInOctoPoints: 0 },
      }}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Provisional reading' }));
  expect(screen.getByRole('tooltip')).toHaveTextContent('Home Mini');
  expect(screen.queryByText(/Possible missed reward/)).not.toBeInTheDocument();
});

it('marks only usage boxes whose half-hour comes from the Mini', async () => {
  const data = demoDataset();
  const start = Date.parse(data.sessions[1].startAt);
  data.imports.find((r) => Date.parse(r.interval_start) === start)!.source = 'home-mini';
  const result = calculateAll(data)[1];
  expect(result.slots.map((slot) => slot.actualProvisional)).toEqual([true, false]);
  render(<SessionDetails result={result} />);
  const usageCards = screen
    .getAllByText('Your usage', { selector: 'dt' })
    .map((term) => term.closest('dl')!);
  expect(
    within(usageCards[0]).getByRole('button', { name: 'Provisional reading' }),
  ).toBeInTheDocument();
  expect(
    within(usageCards[1]).queryByRole('button', { name: 'Provisional reading' }),
  ).not.toBeInTheDocument();
  await userEvent.click(within(usageCards[0]).getByRole('button', { name: 'Provisional reading' }));
  expect(screen.getByRole('tooltip')).toHaveTextContent(
    'This estimate uses figures from your Octopus Home Mini device because your smart meter readings have not arrived yet. These are indicative only and may differ to the smart meter readings.',
  );
});

it('explains Octopus missing data and average credits even when our readings are complete', () => {
  const result = mixed(0.1, 0.1);
  render(
    <SessionDetails
      result={{
        ...result,
        session: {
          ...result.session,
          resultsStatus: 'MISSING_READINGS',
          rewardGivenInOctoPoints: 0,
        },
      }}
    />,
  );
  expect(screen.getByRole('note', { name: 'Octopus missing data' })).toHaveTextContent(
    'Octopus says it will credit the average Octopoints earned in that Session',
  );
  expect(screen.getByRole('note', { name: 'Octopus missing data' })).toHaveTextContent(
    'Your own estimate may differ from an average credit',
  );
  expect(screen.getByText(/Possible missed reward/)).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Calculation summary' })).toBeInTheDocument();
});
