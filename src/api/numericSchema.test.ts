import { expect, it } from 'vitest';
import { numericSchema } from './numericSchema';
import { mergeHomeMini } from './homeMini';
import { milliseconds } from '../domain/time';
import { calculateAll } from '../domain/calculate';
import { precisionFixture } from '../test/precisionFixture';

it.each([
  '',
  ' ',
  'NaN',
  'Infinity',
  '0xff',
  '1junk',
  '1e99999999999999999999',
  '1e-99999999999999999999',
  null,
  Infinity,
  NaN,
])('rejects malformed numeric input %s', (value) => {
  expect(numericSchema.safeParse(value).success).toBe(false);
});
it.each(['0', '-0.001', '1.2300', '.5', '1e-6', 0, 0.125])(
  'preserves validated numeric input %s',
  (value) => {
    expect(numericSchema.parse(value)).toBe(value);
  },
);
it('keeps Mini decimal Wh precision through conversion and calculation', () => {
  const data = precisionFixture();
  const session = data.sessions[0];
  data.imports = data.imports.filter((r) => r.interval_start !== session.startAt);
  data.imports = mergeHomeMini(
    data.imports,
    {
      smartMeterTelemetry: [{ readAt: session.startAt, consumptionDelta: '100.00000000000001' }],
    },
    milliseconds(session.startAt),
    milliseconds(session.endAt),
  );
  const [result] = calculateAll(data);
  expect(result.actual?.toString()).toBe('0.10000000000000001');
  expect(result.rewarded?.toString()).toBe('0.00049999999999999');
  expect(result.provisional).toBe(true);
});
