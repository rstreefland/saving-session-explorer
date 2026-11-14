import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { PLACEHOLDER } from './placeholder';
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
  const energy = within(overview).getByRole('row', { name: /Energy shifted/ });
  const reward = within(overview).getByRole('row', { name: /Reward/ });
  expect(totals.officialEnergy.value).toBeNull();
  expect(totals.overview.officialAchievement.value).toBeNull();
  expect(totals.officialReward.value?.toString()).toBe('64');
  expect(
    within(energy)
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  ).toEqual([PLACEHOLDER, PLACEHOLDER]);
  expect(overview).not.toHaveTextContent('results included');
  expect(reward).toHaveTextContent('64 Octopoints');
  expect(overview).toHaveTextContent('1 Octopus results missing readings');
  await userEvent.click(screen.getByRole('button', { name: 'About these totals' }));
  expect(screen.getByRole('tooltip')).toHaveTextContent(
    'Any average credit from Octopus is still included.',
  );
});
