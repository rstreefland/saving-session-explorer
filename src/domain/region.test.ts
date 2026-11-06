import { expect, it } from 'vitest';
import { inferHolidayRegion } from './region';

it.each(['_N', '_P'])('infers Scottish holidays for %s', (gsp) =>
  expect(inferHolidayRegion(gsp)).toBe('scotland'),
);

it.each(['_A', '_B', '_C', '_D', '_E', '_F', '_G', '_H', '_J', '_K', '_L', '_M'])(
  'infers England/Wales holidays for %s',
  (gsp) => expect(inferHolidayRegion(gsp)).toBe('england-and-wales'),
);

it.each(['', 'NA', '_Z'])('does not guess for unknown group %s', (gsp) =>
  expect(inferHolidayRegion(gsp)).toBeNull(),
);
