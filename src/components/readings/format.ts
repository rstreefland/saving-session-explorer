import { PLACEHOLDER } from '../placeholder';
import { formatTimeRange, iso, local, Temporal } from '../../domain/time';

export function number(value: number | null) {
  if (value === null) return PLACEHOLDER;

  const formatted = value.toFixed(3);

  return formatted === '-0.000' ? '0.000' : formatted;
}

export const halfHourRange = (start: string) =>
  formatTimeRange(start, iso(local(start).add({ minutes: 30 })));

export const referenceDate = (date: string) =>
  Temporal.PlainDate.from(date).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
