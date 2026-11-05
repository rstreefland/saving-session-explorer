import { expect, it } from 'vitest';
import { readingCoverage } from './coverage';
import { demoDataset } from './demo';
it('counts all missing slots and handles both DST transitions', () => {
  const data = { ...demoDataset(), imports: [] };
  expect(readingCoverage(data, '2026-03-29', '2026-03-29', Infinity)).toEqual({
    expected: 46,
    missing: 46,
  });
  expect(readingCoverage(data, '2026-10-25', '2026-10-25', Infinity)).toEqual({
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
  ).toEqual({ expected: 1, missing: 0 });
  expect(
    readingCoverage(
      { ...data, exports: [] },
      '2026-01-01',
      '2026-01-01',
      Date.parse('2026-01-01T00:40:00Z'),
    ).missing,
  ).toBe(1);
});
