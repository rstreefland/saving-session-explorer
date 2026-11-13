import { expect, it } from 'vitest';
import { decimal } from './decimal';
import { sessionTotals } from './totals';
import type { Calculation } from './types';

const base: Calculation = {
  session: {
    eventId: 1,
    startAt: '2026-11-05T17:00:00Z',
    endAt: '2026-11-05T18:00:00Z',
    eventType: 'TURN_DOWN',
    resultsStatus: 'CALCULATING',
    resultsSetAt: null,
    energyDeltaKwh: null,
    baselineConsumptionDeltaKwh: null,
    consumptionDeltaKwh: null,
    rewardGivenInOctoPoints: null,
    rewardPerKwhInOctoPoints: 80,
  },
  slots: [],
  days: [],
  issues: [],
  baseline: decimal(1),
  actual: decimal(0.5),
  rewarded: decimal(0.5),
  netSaved: decimal(0.5),
  difference: null,
  unavailableReason: null,
  state: 'pending',
};

it('sums exact decimal energy independently, excludes pending placeholders, and preserves zero', () => {
  const totals = sessionTotals([
    {
      ...base,
      rewarded: decimal(0.1),
      provisional: true,
      session: {
        ...base.session,
        resultsStatus: 'SUCCESS',
        energyDeltaKwh: 0,
        rewardGivenInOctoPoints: 0,
      },
    },
    {
      ...base,
      rewarded: decimal(0.2),
      session: {
        ...base.session,
        resultsStatus: 'CALCULATING',
        energyDeltaKwh: 99,
        rewardGivenInOctoPoints: 99,
      },
    },
    { ...base, rewarded: null, state: 'incomplete' },
  ]);
  expect(totals.energy.value?.toString()).toBe('0.3');
  expect(totals.energy.available).toBe('2');
  expect(totals.energy.sessions).toBe('3');
  expect(totals.energy.provisional).toBe(true);
  expect(totals.officialEnergy.value?.toString()).toBe('0');
  expect(totals.officialEnergy.available).toBe('1');
  expect(totals.officialReward.value?.toString()).toBe('0');
});

it('keeps unavailable totals unknown and adds rounded session rewards rather than repricing', () => {
  const result = {
    ...base,
    rewarded: decimal(0.21),
    session: { ...base.session, rewardPerKwhInOctoPoints: 80 },
  };
  expect(sessionTotals([result, result]).reward.value?.toString()).toBe('48');
  expect(sessionTotals([]).energy.value).toBeNull();
  expect(sessionTotals([{ ...base, rewarded: null, state: 'incomplete' }]).energy.value).toBeNull();
});

it('keeps Happy Hours cash credit separate and does not invent Power up reward estimates', () => {
  const happy = {
    ...base,
    rewarded: decimal(2),
    session: {
      ...base.session,
      eventType: 'WEEKEND_HAPPY_HOUR',
      resultsStatus: 'SUCCESS',
      energyUsedInKwh: 1.5,
      rewardGivenInPence: 8,
    },
  };
  const totals = sessionTotals([happy, happy]);
  expect(totals.energy.value?.toString()).toBe('4');
  expect(totals.officialEnergy.value?.toString()).toBe('3');
  expect(totals.officialReward.value?.toString()).toBe('16');
  expect(totals.reward.value).toBeNull();
  expect(
    sessionTotals([{ ...base, session: { ...base.session, eventType: 'TURN_UP' } }]).reward.value,
  ).toBeNull();
});

it('counts achievement independently from publication and suppresses provisional alerts', () => {
  const failedSession = { ...base.session, resultsStatus: 'FAIL', rewardGivenInOctoPoints: 0 };
  const totals = sessionTotals([
    base,
    { ...base, provisional: true, session: failedSession },
    { ...base, session: failedSession },
    { ...base, rewarded: null, netSaved: null, state: 'incomplete' },
    {
      ...base,
      netSaved: decimal(0),
      session: { ...base.session, resultsStatus: 'PARTIAL_SUCCESS' },
    },
  ]);
  expect(totals.overview.sessions).toBe('5');
  expect(totals.overview.calculatedAchievement.value?.toString()).toBe('4');
  expect(totals.overview.calculatedAchievement.available).toBe('4');
  expect(totals.overview.calculatedAchievement.provisional).toBe(true);
  expect(totals.overview.officialAchievement.value?.toString()).toBe('1');
  expect(totals.overview.officialAchievement.available).toBe('3');
  expect(totals.overview.missedRewards).toBe('1');
  expect(totals.overview.pending).toBe('2');
  expect(totals.overview.unavailable).toBe('1');
});

it('separates pending, missing and upcoming results without inventing achievement', () => {
  const totals = sessionTotals(
    ['CALCULATING', 'MISSING_READINGS', 'UPCOMING'].map((resultsStatus) => ({
      ...base,
      rewarded: null,
      session: { ...base.session, resultsStatus },
    })),
  );
  expect(totals.overview.pending).toBe('1');
  expect(totals.overview.missing).toBe('1');
  expect(totals.overview.upcoming).toBe('1');
  expect(totals.overview.officialAchievement.value).toBeNull();
  expect(totals.overview.calculatedAchievement.value).toBeNull();
  expect(totals.overview.missedRewards).toBe('0');
});
