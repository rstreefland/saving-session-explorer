import { Temporal, local, milliseconds, referenceTime } from '../domain/time';
import { decimal } from '../domain/decimal';
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

  const start = milliseconds(session.startAt);

  for (const reading of data.imports) {
    const offset = decimal(
      Temporal.Instant.fromEpochMilliseconds(start)
        .until(Temporal.Instant.from(reading.interval_start))
        .total('minutes'),
    )
      .div(30)
      .toNumber();

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
  ).toEqual(['0.600', '0.100', '0.500', '0.500 kWh']);
  expect(
    within(equations[1])
      .getAllByRole('definition')
      .map((value) => value.textContent),
  ).toEqual(['0.600', '0.700', '-0.100', '0.000 kWh']);
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

  result.slots[0].baseline = decimal(0.194);
  result.slots[1].baseline = decimal(0.202);
  Object.assign(result, {
    baseline: decimal(0.396),
    actual: decimal(0.321),
    netSaved: decimal(0.075),
    rewarded: decimal(0.077),
  });
  render(<SessionDetails result={result} />);

  const summary = screen.getByRole('region', { name: 'Calculation summary' });

  expect(summary).toHaveTextContent('Change-0.002Counts for rewards0.000 kWh');
  expect(summary).toHaveTextContent('Counts for rewards0.077 kWh');
  expect(summary).toHaveTextContent('Total shifted for rewards0.077 kWh');
  expect(summary).not.toHaveTextContent('0.075');
});

it('retains earned shifts when usage rises over the session as a whole', () => {
  render(<SessionDetails result={mixed(0.1, 1.2)} />);

  const summary = screen.getByRole('region', { name: 'Calculation summary' });

  expect(summary).toHaveTextContent('Counts for rewards0.500 kWh');
  expect(summary).toHaveTextContent('Change-0.600Counts for rewards0.000 kWh');
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
  ).toEqual(['1.100', '0.600', '0.500', '0.500 kWh']);
  expect(
    within(equations[1])
      .getAllByRole('definition')
      .map((value) => value.textContent),
  ).toEqual(['0.500', '0.600', '-0.100', '0.000 kWh']);
  expect(summary).toHaveTextContent('Total shifted for rewards0.500 kWh');
});

it.each([false, true])('shows zero when no half-hour qualifies (Power up: %s)', (up) => {
  render(<SessionDetails result={up ? mixed(0.2, 0.3, true) : mixed(0.8, 0.7)} />);

  const summary = screen.getByRole('region', { name: 'Calculation summary' });

  expect(
    within(summary)
      .getAllByText('Counts for rewards')
      .map((term) => term.parentElement?.textContent),
  ).toEqual(['Counts for rewards0.000 kWh', 'Counts for rewards0.000 kWh']);
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
  expect(readings[0]).toHaveTextContent('Imported0.150');
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

  result.slots[0].references[0].value = decimal(0.123);
  result.slots[1].references[0].value = decimal(0.456);
  render(<SessionDetails result={result} />);

  const user = userEvent.setup();

  await user.click(screen.getByText(/Days used for baseline/));

  const table = screen.getByRole('table', { name: 'Readings used for baseline' });

  expect(within(table).getByText('0.123')).toBeInTheDocument();
  expect(within(table).getAllByRole('row')).toHaveLength(
    decimal(result.days.length).plus(2).toNumber(),
  );

  expect(screen.getByRole('option', { name: '5:00pm – 5:30pm' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '5:30pm – 6:00pm' })).toBeInTheDocument();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Half-hour to inspect' }), '1');

  expect(within(table).getByText('0.456')).toBeInTheDocument();
  expect(within(table).queryByText('0.123')).not.toBeInTheDocument();
  expect(table).toHaveTextContent('Average for this half-hour0.600');
});

it('shows the average of known reference readings and missing count while keeping the session baseline incomplete', async () => {
  const data = demoDataset();
  const before = calculateAll(data)[1];

  data.imports = data.imports.filter(
    (reading) => !reading.interval_start.startsWith(before.days[0]),
  );
  render(<SessionDetails result={calculateAll(data)[1]} />);

  const summary = screen.getByRole('region', { name: 'Calculation summary' });
  expect(summary).toHaveTextContent('This estimate is incomplete.');
  expect(summary).toHaveTextContent('Total shifted for rewards•••');

  await userEvent.click(screen.getByText(/Days used for baseline/));

  const table = screen.getByRole('table', { name: 'Readings used for baseline' });

  expect(within(table).getAllByText('•••')).toHaveLength(1);
  expect(table).toHaveTextContent('Average of known readings9 of 10 days (1 missing)0.600');
  expect(
    screen.getByText(
      '1 reference reading is missing, so this half-hour’s full baseline cannot be calculated yet. The average above uses only the 9 known readings.',
    ),
  ).toBeVisible();
});

it('shows plural missing counts and falls back to the placeholder when all reference readings are missing', async () => {
  const data = demoDataset();
  const before = calculateAll(data)[1];

  data.imports = data.imports.filter(
    (reading) =>
      !reading.interval_start.startsWith(before.days[0]) &&
      !reading.interval_start.startsWith(before.days[1]),
  );
  const view = render(<SessionDetails result={calculateAll(data)[1]} />);
  await userEvent.click(screen.getByText(/Days used for baseline/));

  const table = screen.getByRole('table', { name: 'Readings used for baseline' });

  expect(within(table).getAllByText('•••')).toHaveLength(2);
  expect(table).toHaveTextContent('Average of known readings8 of 10 days (2 missing)0.600');
  expect(
    screen.getByText(
      '2 reference readings are missing, so this half-hour’s full baseline cannot be calculated yet. The average above uses only the 8 known readings.',
    ),
  ).toBeVisible();

  data.imports = data.imports.filter(
    (reading) =>
      !before.days.some((referenceDay) => reading.interval_start.startsWith(referenceDay)),
  );
  view.rerender(<SessionDetails result={calculateAll(data)[1]} />);

  expect(within(table).getAllByText('•••')).toHaveLength(11);
  expect(table).toHaveTextContent('Average for this half-hour•••');
  expect(
    screen.getByText(
      'All 10 reference readings are missing, so this half-hour’s average cannot be calculated.',
    ),
  ).toBeVisible();
});

it('marks baseline days supplied by Home Mini with the provisional indicator and tooltip', async () => {
  const data = demoDataset();
  const before = calculateAll(data)[1];
  const target = referenceTime(before.days[0], local(before.session.startAt).toPlainTime());
  const baselineReading = data.imports.find((r) => milliseconds(r.interval_start) === target)!;
  baselineReading.source = 'home-mini';
  baselineReading.consumption = 0.5;

  render(<SessionDetails result={calculateAll(data)[1]} />);
  await userEvent.click(screen.getByText(/Days used for baseline/));

  const table = screen.getByRole('table', { name: 'Readings used for baseline' });
  const rows = within(table).getAllByRole('row');
  const firstReferenceRow = rows[1];
  const secondReferenceRow = rows[2];
  const footerRow = rows[rows.length - 1];

  expect(within(firstReferenceRow).getByText('0.500')).toBeInTheDocument();
  expect(
    within(firstReferenceRow).getByRole('button', { name: 'Provisional reading' }),
  ).toBeInTheDocument();
  expect(
    within(secondReferenceRow).queryByRole('button', { name: 'Provisional reading' }),
  ).not.toBeInTheDocument();
  expect(
    within(footerRow).getByRole('button', { name: 'Provisional reading' }),
  ).toBeInTheDocument();

  await userEvent.click(
    within(firstReferenceRow).getByRole('button', { name: 'Provisional reading' }),
  );
  expect(screen.getByRole('tooltip')).toHaveTextContent(
    'This estimate uses figures from your Octopus Home Mini device because your smart meter readings have not arrived yet. These are indicative only and may differ to the smart meter readings.',
  );
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
  const start = milliseconds(data.sessions[1].startAt);

  data.eventDays = Array.from({ length: 60 }, (_, i) =>
    Temporal.Instant.fromEpochMilliseconds(start)
      .subtract({ hours: decimal(i).plus(1).times(24).toNumber() })
      .toString()
      .slice(0, 10),
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

it('marks only usage values whose half-hour comes from the Mini', async () => {
  const data = demoDataset();
  const start = milliseconds(data.sessions[1].startAt);
  data.imports.find((r) => milliseconds(r.interval_start) === start)!.source = 'home-mini';
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

it('keeps the full calculation explanation available in a disclosure', async () => {
  render(<SessionDetails result={mixed(1.1, 0.5, true)} />);
  const summary = screen.getByRole('region', { name: 'Calculation summary' });
  const explanation =
    'Power down and Power up use electricity imported minus electricity exported.';

  expect(within(summary).queryByText(explanation)).not.toBeInTheDocument();
  await userEvent.click(within(summary).getByText('How this is calculated'));
  expect(within(summary).getByText(explanation)).toBeVisible();
  expect(within(summary).getByText(/Each half-hour is counted separately/)).toHaveTextContent(
    'Each half-hour is counted separately. Only usage above baseline counts towards rewards; other half-hours count as zero.',
  );
});
