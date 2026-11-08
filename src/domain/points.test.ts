import { decimal } from './decimal';
import { expect, it } from 'vitest';
import { calculateAll } from './calculate';
import { demoDataset } from './demo';
import { actualOctopoints, estimateOctopoints } from './points';
import type { Calculation } from './types';

const base = calculateAll(demoDataset())[1];

function result(shifted: number | string | null, rate: number | null | undefined): Calculation {
  return {
    ...base,
    rewarded: shifted === null ? null : decimal(shifted),
    session: { ...base.session, rewardPerKwhInOctoPoints: rate },
  };
}

it.each([
  [0.1952, 75, 14.64, 16, 16],
  [0.1471, 16, 2.3536, 8, 16],
  [0.0015, 108, 0.162, 8, 16],
  [0.21, 80, 16.8, 24, 24],
  [0.3, 80, 24, 24, 24],
  [0.300001, 80, 24.00008, 32, 32],
  [decimal(0.1).plus(0.2).toNumber(), 80, 24, 24, 24],
  [0, 80, 0, 0, 0],
  ['0.0000000000000002220446049250313', 80, '0.000000000000017763568394002504', 8, 16],
  [0.000001, 80, 0.00008, 8, 16],
  [1, 0, 0, 0, 0],
])(
  'estimates %s kWh at %s points/kWh without rounding energy first',
  (kwh, rate, raw, rounded, points) => {
    const estimate = estimateOctopoints(result(kwh, rate));

    expect(estimate.state).toBe('ready');

    if (estimate.state !== 'ready') throw new Error('Expected ready estimate');

    expect(estimate.raw).toEqual(decimal(raw));
    expect(estimate.pennyRounded?.toNumber()).toBe(rounded);
    expect(estimate.points?.toNumber()).toBe(points);
  },
);

it('rounds the session total once and never derives the estimate from official figures', () => {
  const original = result(0.21, 80);

  const changed = {
    ...original,
    session: { ...original.session, rewardGivenInOctoPoints: 1000, energyDeltaKwh: 999 },
  };

  expect(estimateOctopoints(original)).toMatchObject({
    points: decimal(24),
    actual: decimal(72),
    difference: decimal(-48),
  });
  expect(estimateOctopoints(changed)).toMatchObject({
    points: decimal(24),
    actual: decimal(1000),
    difference: decimal(-976),
  });
});

it('does not award minimum points for floating-point noise in identical baseline and session readings', () => {
  const data = demoDataset();

  data.imports = data.imports.map((reading) => ({ ...reading, consumption: 0.7 }));

  const unchanged = calculateAll(data)[1];

  expect(estimateOctopoints(unchanged)).toMatchObject({
    state: 'ready',
    points: decimal(0),
    raw: decimal(0),
  });
});

it.each([null, undefined, -1, NaN, Infinity])('withholds a reward when the rate is %s', (rate) => {
  expect(estimateOctopoints(result(0.5, rate))).toEqual({ state: 'unavailable', reason: 'rate' });
});

it.each([null, -1])('withholds an invalid or missing energy estimate (%s)', (kwh) => {
  expect(estimateOctopoints(result(kwh, 80))).toEqual({
    state: 'unavailable',
    reason: 'readings',
  });
});

it('requires complete readings even if a partial energy total is present', () => {
  expect(estimateOctopoints({ ...result(0.5, 80), state: 'incomplete' })).toEqual({
    state: 'unavailable',
    reason: 'readings',
  });
});

it('rejects overflow rather than displaying an invalid reward', () => {
  expect(estimateOctopoints(result(Number.MAX_VALUE, 80))).toEqual({
    state: 'unavailable',
    reason: 'rate',
  });
  expect(estimateOctopoints(result(Number.MAX_SAFE_INTEGER, 1))).toEqual({
    state: 'unavailable',
    reason: 'rate',
  });
});

it.each(['CALCULATING', 'UPCOMING', null])(
  'still estimates before official results are published (%s)',
  (resultsStatus) => {
    const calculation = result(0.1952, 75);

    calculation.state = 'pending';
    calculation.session.resultsStatus = resultsStatus;
    calculation.session.rewardGivenInOctoPoints = 0;

    expect(estimateOctopoints(calculation)).toMatchObject({
      points: decimal(16),
      actual: null,
      difference: null,
    });
  },
);

it.each(['SUCCESS', 'PARTIAL_SUCCESS', 'FAIL', 'MISSING_READINGS'])(
  'compares only explicitly supplied final points (%s)',
  (resultsStatus) => {
    const calculation = result(0.1952, 75);

    calculation.session.resultsStatus = resultsStatus;
    calculation.session.rewardGivenInOctoPoints = 0;

    expect(estimateOctopoints(calculation)).toMatchObject({
      points: decimal(16),
      actual: decimal(0),
      difference: decimal(16),
    });

    calculation.session.rewardGivenInOctoPoints = 16;

    expect(estimateOctopoints(calculation)).toMatchObject({ difference: decimal(0) });

    calculation.session.rewardGivenInOctoPoints = null;

    expect(estimateOctopoints(calculation)).toMatchObject({ actual: null, difference: null });
  },
);

it.each([-1, NaN, Infinity])(
  'does not compare invalid official points (%s)',
  (rewardGivenInOctoPoints) => {
    expect(actualOctopoints({ ...base.session, rewardGivenInOctoPoints })).toBeNull();
  },
);

it.each([
  ['TURN_UP', 'tariff'],
  ['WEEKEND_HAPPY_HOUR', 'cash'],
  ['UNKNOWN', 'unsupported'],
])('does not invent Octopoints for %s', (eventType, reason) => {
  const calculation = result(0.5, 0);

  calculation.session.eventType = eventType;

  expect(estimateOctopoints(calculation)).toEqual({ state: 'unavailable', reason });
});

it('does not price unsupported session windows', () => {
  expect(estimateOctopoints({ ...result(0.5, 80), state: 'unsupported' })).toEqual({
    state: 'unavailable',
    reason: 'unsupported',
  });
});
