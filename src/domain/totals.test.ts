import { expect, it } from 'vitest';
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
  baseline: 1,
  actual: 0.5,
  rewarded: 0.5,
  netSaved: 0.5,
  difference: null,
  unavailableReason: null,
  state: 'pending',
};

it('sums exact decimal energy independently, excludes pending placeholders, and preserves zero', () => {
  const totals = sessionTotals([
    {
      ...base,
      rewarded: 0.1,
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
      rewarded: 0.2,
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
    rewarded: 0.21,
    session: { ...base.session, rewardPerKwhInOctoPoints: 80 },
  };
  expect(sessionTotals([result, result]).reward.value?.toString()).toBe('48');
  expect(sessionTotals([]).energy.value).toBeNull();
  expect(sessionTotals([{ ...base, rewarded: null, state: 'incomplete' }]).energy.value).toBeNull();
});

it('keeps Happy Hours cash credit separate and does not invent Power up reward estimates', () => {
  const happy = {
    ...base,
    rewarded: 2,
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
