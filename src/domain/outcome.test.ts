import { expect, it } from 'vitest';
import { sessionOutcome } from './outcome';
import { calculateAll } from './calculate';
import { demoDataset } from './demo';

it('keeps awarded sessions positive regardless of differences in energy estimates', () => {
  const result = calculateAll(demoDataset())[1];

  for (const difference of [-0.2, -0.018, 0.26]) {
    const outcome = sessionOutcome({ ...result, difference, state: 'difference' });

    expect(outcome.label).toBe('Achieved');
    expect(outcome.attention).toBe(false);
  }
});

it('flags a possible missed reward only for a qualifying estimate with no final reward', () => {
  const result = calculateAll(demoDataset())[1];

  for (const resultsStatus of ['FAIL', 'MISSING_READINGS']) {
    const outcome = sessionOutcome({
      ...result,
      session: { ...result.session, resultsStatus, rewardGivenInOctoPoints: 0 },
    });

    expect(outcome.achieved).toBe(true);
    expect(outcome.attention).toBe(true);
  }

  for (const resultsStatus of ['CALCULATING', 'UPCOMING', 'SUCCESS', 'PARTIAL_SUCCESS', null]) {
    expect(
      sessionOutcome({
        ...result,
        session: { ...result.session, resultsStatus, rewardGivenInOctoPoints: 0 },
      }).attention,
    ).toBe(false);
  }

  expect(
    sessionOutcome({
      ...result,
      rewarded: 0,
      session: { ...result.session, resultsStatus: 'FAIL', rewardGivenInOctoPoints: 0 },
    }).attention,
  ).toBe(false);
  expect(
    sessionOutcome({
      ...result,
      session: { ...result.session, resultsStatus: 'FAIL', rewardGivenInOctoPoints: 8 },
    }).attention,
  ).toBe(false);
});

it('does not infer achievement when readings are missing, or promise Happy Hour credit', () => {
  const data = demoDataset();

  expect(sessionOutcome(calculateAll(data)[3]).label).toBe('Awaiting meter readings');

  const result = calculateAll(data)[0];

  const outcome = sessionOutcome({
    ...result,
    session: {
      ...result.session,
      eventType: 'WEEKEND_HAPPY_HOUR',
      resultsStatus: 'FAIL',
      rewardGivenInPence: 0,
    },
  });

  expect(outcome.label).toBe('Usage recorded');
  expect(outcome.attention).toBe(false);
});

it.each([
  ['TURN_DOWN', [0.1, 0.7], 'Achieved', 0.5, 0.4],
  ['TURN_DOWN', [0.1, 1.2], 'Partly achieved', 0.5, -0.1],
  ['TURN_DOWN', [0.1, 1.1], 'Partly achieved', 0.5, 0],
  ['TURN_DOWN', [0.7, 0.8], 'Not achieved', 0, -0.3],
  ['TURN_UP', [1.1, 0.5], 'Achieved', 0.5, -0.4],
  ['TURN_UP', [1.1, 0], 'Partly achieved', 0.5, 0.1],
  ['TURN_UP', [1.1, 0.1], 'Partly achieved', 0.5, 0],
  ['TURN_UP', [0.5, 0.4], 'Not achieved', 0, 0.3],
] as const)(
  'classifies %s readings %j as %s using the whole-window net change',
  (eventType, readings, label, rewarded, netSaved) => {
    const data = demoDataset();
    const session = data.sessions[1];

    session.eventType = eventType;
    // Deliberately withhold Octopus's result: the estimate must be independent.
    session.resultsStatus = 'CALCULATING';

    const start = Date.parse(session.startAt);

    for (const reading of data.imports) {
      const offset = (Date.parse(reading.interval_start) - start) / 1_800_000;

      if (offset === 0 || offset === 1) reading.consumption = readings[offset];
    }

    const result = calculateAll(data)[1];

    expect(result.rewarded).toBeCloseTo(rewarded);
    expect(result.netSaved).toBeCloseTo(netSaved);
    expect(sessionOutcome(result).label).toBe(label);
    expect(sessionOutcome(result).attention).toBe(false);
  },
);

it('flags a final failed session with no reported reward but does not guess that missing-readings null means zero', () => {
  const result = calculateAll(demoDataset())[1];

  expect(
    sessionOutcome({
      ...result,
      session: { ...result.session, resultsStatus: 'FAIL', rewardGivenInOctoPoints: null },
    }).attention,
  ).toBe(true);
  expect(
    sessionOutcome({
      ...result,
      session: {
        ...result.session,
        resultsStatus: 'MISSING_READINGS',
        rewardGivenInOctoPoints: null,
      },
    }).attention,
  ).toBe(false);
});

it('does not flag possible missed rewards from provisional Mini estimates', () => {
  const result = calculateAll(demoDataset())[1];
  expect(
    sessionOutcome({
      ...result,
      provisional: true,
      session: { ...result.session, resultsStatus: 'FAIL', rewardGivenInOctoPoints: 0 },
    }).attention,
  ).toBe(false);
});
