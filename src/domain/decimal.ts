import DecimalBase from 'decimal.js-light';

// 40 significant digits, truncating division: terminating input arithmetic stays
// exact at meter scales; display and reward rounding are always explicit.
export const Decimal = DecimalBase.clone({ precision: 40, rounding: DecimalBase.ROUND_DOWN });
export type Decimal = DecimalBase;
export type Numeric = number | string;
export const decimal = (value: Numeric | Decimal) => new Decimal(value);
export const positive = (value: Decimal) => (value.isPositive() ? value : decimal(0));
export const total = (values: (Decimal | null)[]): Decimal | null => {
  if (!values.length || values.some((value) => value === null)) return null;
  return values.reduce<Decimal>((sum, value) => sum.plus(value ?? 0), decimal(0));
};

/** Round in Decimal; Intl groups the integer without a lossy Number conversion. */
export const formatNumeric = (value: Numeric | Decimal, maximumFractionDigits = 3) => {
  const [integer, fraction = ''] = decimal(value)
    .toFixed(maximumFractionDigits, Decimal.ROUND_HALF_UP)
    .split('.');
  const grouped = BigInt(integer).toLocaleString('en-GB');
  const suffix = fraction.replace(/0+$/, '');
  return `${integer === '-0' ? '-' : ''}${grouped}${suffix ? `.${suffix}` : ''}`;
};
export const fixed = (value: Numeric | Decimal, places: number) =>
  decimal(value).toFixed(places, Decimal.ROUND_HALF_UP);

export const minimum = (...values: (Numeric | Decimal)[]) =>
  values.map(decimal).reduce((best, value) => (value.lt(best) ? value : best));
export const maximum = (...values: (Numeric | Decimal)[]) =>
  values.map(decimal).reduce((best, value) => (value.gt(best) ? value : best));
