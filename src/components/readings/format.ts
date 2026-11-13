import { fixed, type Decimal, type Numeric } from '../../domain/decimal';
import { PLACEHOLDER } from '../placeholder';
import { formatTimeRange, iso, local } from '../../domain/time';

export function number(value: Numeric | Decimal | null) {
  if (value === null) return PLACEHOLDER;

  const formatted = fixed(value, 3);

  return formatted === '-0.000' ? '0.000' : formatted;
}

export const halfHourRange = (start: string) =>
  formatTimeRange(start, iso(local(start).add({ minutes: 30 })));
