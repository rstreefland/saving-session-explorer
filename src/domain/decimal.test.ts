import { expect, it } from 'vitest';
import { Decimal, decimal, fixed, formatNumeric, total } from './decimal';
import { calculateAll } from './calculate';
import { estimateOctopoints } from './points';
import { sessionOutcome } from './outcome';
import { precisionFixture, referenceDates } from '../test/precisionFixture';

it('uses 40 significant digits for nonterminating division and explicit half-up display rounding', () => {
  expect(decimal(1).div(3).toString()).toBe('0.3333333333333333333333333333333333333333');
  expect(fixed('1.005', 2)).toBe('1.01');
  expect(fixed('-1.005', 2)).toBe('-1.01');
  expect(formatNumeric('1234.1005')).toBe('1,234.101');
  expect(formatNumeric('0.0000005', 6)).toBe('0.000001');
  expect(formatNumeric('9007199254740993.125')).toBe('9,007,199,254,740,993.125');
  expect(formatNumeric('-0.0001')).toBe('-0');
  expect(total([])).toBeNull();
  expect(total([decimal(1), null])).toBeNull();
  expect(total([decimal('0.1'), decimal('0.2')])?.toString()).toBe('0.3');
});

it.each([false, true])(
  'keeps the same exact mean for mixed and uniform references (%s)',
  (uniform) => {
    // Five 0.100 + five 0.101 = 1.005; divided by ten = 0.1005.
    const data = precisionFixture(uniform);
    // JSON number inputs must agree with the string-input App/API examples.
    data.imports = data.imports.map((reading) => ({
      ...reading,
      consumption: Number(reading.consumption),
    }));
    const [result] = calculateAll(data);
    expect(result.days).toEqual(referenceDates);
    expect(result.baseline).toBeInstanceOf(Decimal);
    expect(result.baseline?.toString()).toBe('0.1005');
    expect(fixed(result.baseline ?? 0, 3)).toBe('0.101');
    expect(result.rewarded?.toString()).toBe('0.1005');
    expect(result.state).toBe('match');
    expect(estimateOctopoints(result)).toMatchObject({
      raw: decimal('8.04'),
      pennyRounded: decimal(16),
      points: decimal(16),
      difference: decimal(0),
    });
  },
);

it.each([
  ['0.3', '24', '24'],
  ['0.3000000000000001', '24.000000000000008', '32'],
  ['0.0000000000000001', '0.000000000000008', '16'],
  ['0', '0', '0'],
])('prices exact energy %s without binary epsilon snapping', (energy, raw, points) => {
  const [result] = calculateAll(precisionFixture());
  result.rewarded = decimal(energy);
  expect(estimateOctopoints(result)).toMatchObject({ raw: decimal(raw), points: decimal(points) });
});

it.each([
  ['0.0905', 'match'], // Difference exactly +0.01.
  ['0.1105', 'match'], // Difference exactly -0.01.
  ['0.0904999999', 'difference'], // +0.0100000001, previously hidden by binary guard.
  ['0.1105000001', 'difference'],
])('compares the absolute 0.01 kWh tolerance exactly (%s)', (reported, state) => {
  const data = precisionFixture();
  data.sessions[0].energyDeltaKwh = reported;
  expect(calculateAll(data)[0].state).toBe(state);
});

it('preserves the explicit achievement threshold independently of positive reward pricing', () => {
  const [result] = calculateAll(precisionFixture());
  result.rewarded = decimal('0.000000001');
  result.netSaved = result.rewarded;
  expect(sessionOutcome(result).code).toBe('not-achieved');
  result.rewarded = decimal('0.0000000011');
  result.netSaved = result.rewarded;
  expect(sessionOutcome(result).code).toBe('achieved');
});
