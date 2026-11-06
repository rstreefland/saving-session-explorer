import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { calculateAll } from '../../domain/calculate';
import { demoDataset } from '../../domain/demo';
import { PointsBreakdown } from './PointsBreakdown';
import type { Calculation } from '../../domain/types';

const base = calculateAll(demoDataset())[1];

function calculation(shifted = 0.1952, rate = 75, actual: number | null = 16): Calculation {
  return {
    ...base,
    rewarded: shifted,
    session: { ...base.session, rewardPerKwhInOctoPoints: rate, rewardGivenInOctoPoints: actual },
  };
}

it('shows the energy, independently supplied rate, rounding and exact matching award', () => {
  render(<PointsBreakdown result={calculation()} />);

  const region = screen.getByRole('region', { name: 'Octopoints estimate' });

  expect(region).toHaveTextContent('0.1952 kWh × 75 points/kWh = 14.64 points.');
  expect(region).toHaveTextContent('14.64 → 16 points (8 points = 1p).');
  expect(region).toHaveTextContent('Already at or above 16 points, so no change.');
  expect(region).toHaveTextContent('0 Octopoints. Matches Octopus.');
  expect(region).toHaveTextContent(
    'The exact formula has not been published by Octopus, so these are assumptions.',
  );
});

it('explains the assumed minimum without changing the meter-derived shifted energy', () => {
  render(<PointsBreakdown result={calculation(0.1471, 16)} />);

  expect(screen.getByRole('list')).toHaveTextContent('0.1471 kWh × 16 points/kWh = 2.3536 points.');
  expect(screen.getByRole('list')).toHaveTextContent('2.3536 → 8 points');
  expect(screen.getByRole('list')).toHaveTextContent('8 → 16 points.');
});

it('shows a genuine zero without applying a minimum', () => {
  render(<PointsBreakdown result={calculation(0, 75, 0)} />);

  expect(screen.getByText('No points earned, so no minimum applies.')).toBeVisible();
  expect(screen.getByText('0 Octopoints. Matches Octopus.')).toBeVisible();
});

it.each([
  [0, '+16'],
  [24, '-8'],
])('shows a neutral signed difference from %s actual points', (actual, difference) => {
  render(<PointsBreakdown result={calculation(0.1952, 75, actual)} />);

  expect(screen.getByText(`${difference} Octopoints (calculated minus Octopus).`)).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(/missed reward/i)).not.toBeInTheDocument();
});

it.each(['CALCULATING', 'SUCCESS', 'MISSING_READINGS'])(
  'withholds comparison to unavailable supplier points (%s)',
  (resultsStatus) => {
    const result = calculation(0.1952, 75, resultsStatus === 'CALCULATING' ? 0 : null);

    result.session.resultsStatus = resultsStatus;
    render(<PointsBreakdown result={result} />);

    expect(screen.getByText('Actual reward').nextElementSibling).toHaveTextContent('•••');
    expect(screen.getByText('Difference').nextElementSibling).toHaveTextContent('•••');
    expect(screen.queryByText(/Matches Octopus/)).not.toBeInTheDocument();
  },
);

it('names missing rates and retains the actual reward without inventing a difference', () => {
  const result = calculation();

  result.session.rewardPerKwhInOctoPoints = undefined;
  render(<PointsBreakdown result={result} />);

  expect(screen.getByText(/has not supplied a usable points-per-kWh rate/)).toBeVisible();
  expect(screen.getByText('Calculated reward').nextElementSibling).toHaveTextContent('•••');
  expect(screen.getByText('Difference').nextElementSibling).toHaveTextContent('•••');
  expect(screen.getByText('Actual reward').nextElementSibling).toHaveTextContent('16 Octopoints');
});

it('does not present a partial meter calculation as a complete reward', () => {
  render(<PointsBreakdown result={{ ...calculation(), state: 'incomplete', rewarded: null }} />);

  expect(screen.getByText('A complete energy estimate is needed first.')).toBeVisible();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

it('hides reward estimates for Power up and Happy Hours', () => {
  const result = calculation();

  result.session.eventType = 'TURN_UP';

  const view = render(<PointsBreakdown result={result} />);

  expect(screen.queryByRole('region')).not.toBeInTheDocument();

  view.rerender(
    <PointsBreakdown
      result={{ ...result, session: { ...result.session, eventType: 'WEEKEND_HAPPY_HOUR' } }}
    />,
  );

  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
