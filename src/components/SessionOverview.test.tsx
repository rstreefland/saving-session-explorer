import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { PLACEHOLDER } from './placeholder';
import { SessionOverview } from './SessionOverview';
import { sessionTotals } from '../domain/totals';
import { calculateAll } from '../domain/calculate';
import { demoDataset } from '../domain/demo';

it('includes average credits while keeping missing energy unavailable', () => {
  const base = calculateAll(demoDataset())[0];
  const totals = sessionTotals([
    {
      ...base,
      rewarded: null,
      session: {
        ...base.session,
        resultsStatus: 'MISSING_READINGS',
        rewardGivenInOctoPoints: '64',
      },
    },
  ]);
  render(<SessionOverview totals={totals} type="TURN_DOWN" />);
  const overview = screen.getByRole('region', { name: 'Session overview' });
  const calculated = within(overview).getByRole('group', { name: 'Calculated' });
  const octopus = within(overview).getByRole('group', { name: 'Octopus' });
  expect(totals.officialEnergy.value).toBeNull();
  expect(totals.overview.officialAchievement.value).toBeNull();
  expect(totals.officialReward.value?.toString()).toBe('64');
  expect(within(calculated).getByText('Energy shifted').nextElementSibling).toHaveTextContent(
    PLACEHOLDER,
  );
  expect(within(octopus).getByText('Energy shifted').nextElementSibling).toHaveTextContent(
    PLACEHOLDER,
  );
  expect(overview).not.toHaveTextContent('results included');
  expect(within(octopus).getByText('Reward').nextElementSibling).toHaveTextContent('64 Octopoints');
  expect(overview).toHaveTextContent('1 Octopus results missing readings');
});
