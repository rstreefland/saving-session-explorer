import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { SessionOverview } from './SessionOverview';
import { sessionTotals } from '../domain/totals';
import { calculateAll } from '../domain/calculate';
import { demoDataset } from '../domain/demo';

it('explains included average credits while keeping missing energy unavailable', async () => {
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
  const energy = within(overview).getByRole('rowheader', { name: 'Energy shifted' }).closest('tr');
  const reward = within(overview).getByRole('rowheader', { name: 'Reward' }).closest('tr');
  expect(totals.officialEnergy.value).toBeNull();
  expect(totals.overview.officialAchievement.value).toBeNull();
  expect(totals.officialReward.value?.toString()).toBe('64');
  expect(totals.officialReward.available).toBe('1');
  expect(energy).toHaveTextContent('0 of 1 results included');
  expect(reward).toHaveTextContent('64 Octopoints');
  expect(overview).toHaveTextContent('1 Octopus results missing readings');
  await userEvent.click(screen.getByRole('button', { name: 'About these totals' }));
  expect(screen.getByRole('tooltip')).toHaveTextContent(
    'Supplied Octopus average credits for sessions with missing readings can still contribute to reward totals.',
  );
});
