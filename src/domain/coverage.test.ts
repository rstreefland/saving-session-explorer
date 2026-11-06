import { expect, it } from 'vitest';
import { readingCoverage } from './coverage';
import { demoDataset } from './demo';

it('counts all missing slots and handles both DST transitions', () => {
  const data = { ...demoDataset(), imports: [] };

  expect(readingCoverage(data, '2026-03-29', '2026-03-29', Infinity)).toMatchObject({
    expected: 46,
    missing: 46,
  });
  expect(readingCoverage(data, '2026-10-25', '2026-10-25', Infinity)).toMatchObject({
    expected: 50,
    missing: 50,
  });
});

it('does not require future slots and distinguishes zero readings from missing export', () => {
  const data = {
    ...demoDataset(),
    imports: [
      {
        interval_start: '2026-01-01T00:00:00Z',
        interval_end: '2026-01-01T00:30:00Z',
        consumption: 0,
      },
    ],
  };

  expect(
    readingCoverage(data, '2026-01-01', '2026-01-01', Date.parse('2026-01-01T00:40:00Z')),
  ).toMatchObject({ expected: 1, missing: 0 });
  expect(
    readingCoverage(
      { ...data, exports: [] },
      '2026-01-01',
      '2026-01-01',
      Date.parse('2026-01-01T00:40:00Z'),
    ).missing,
  ).toBe(1);
});

it('merges contiguous gaps across dates, invalid readings and Mini availability changes', () => {
  const data = {
    ...demoDataset(),
    imports: [
      {
        interval_start: '2026-11-05T00:00:00Z',
        interval_end: '2026-11-05T00:30:00Z',
        consumption: -1,
      },
      {
        interval_start: '2026-11-05T00:30:00Z',
        interval_end: '2026-11-05T01:00:00Z',
        consumption: 0.2,
        source: 'home-mini' as const,
      },
    ],
    exports: null,
  };
  const coverage = readingCoverage(
    data,
    '2026-11-03',
    '2026-11-05',
    Date.parse('2026-11-05T01:10:00Z'),
  );
  expect(coverage).toMatchObject({
    expected: 98,
    missing: 97,
  });
  expect(coverage.gaps).toEqual([
    {
      status: 'pending',
      start: '2026-11-03T00:00:00.000Z',
      end: '2026-11-05T01:00:00.000Z',
      count: 98,
      meters: 'import',
      homeMiniCount: 1,
    },
  ]);
});

it('counts each half-hour once when both meters are absent and retains DST intervals', () => {
  const coverage = readingCoverage(
    { ...demoDataset(), imports: [], exports: [] },
    '2026-10-25',
    '2026-10-25',
    Date.parse('2026-10-26T00:00:00Z'),
  );
  expect(coverage).toMatchObject({ expected: 50, missing: 50 });
  expect(coverage.gaps).toHaveLength(1);
  expect(coverage.gaps[0]).toMatchObject({
    meters: 'import and export',
    count: 50,
    start: '2026-10-24T23:00:00.000Z',
    end: '2026-10-26T00:00:00.000Z',
  });
});

it('splits a contiguous gap only at the seven-day status boundary', () => {
  const coverage = readingCoverage(
    { ...demoDataset(), imports: [], exports: null },
    '2026-11-03',
    '2026-11-03',
    Date.parse('2026-11-10T12:00:00Z'),
  );
  expect(coverage.gaps).toEqual([
    {
      start: '2026-11-03T00:00:00.000Z',
      end: '2026-11-03T11:30:00.000Z',
      count: 23,
      meters: 'import',
      homeMiniCount: 0,
      status: 'presumed missing',
    },
    {
      start: '2026-11-03T11:30:00.000Z',
      end: '2026-11-04T00:00:00.000Z',
      count: 25,
      meters: 'import',
      homeMiniCount: 0,
      status: 'pending',
    },
  ]);
});
