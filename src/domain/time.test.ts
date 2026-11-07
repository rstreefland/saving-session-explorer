import { expect, it } from 'vitest';
import { clockTime, formatTimeRange, formatDate } from './time';
import { halfHourRange } from '../components/readings/format';

it.each([
  ['2026-11-05T00:00:00Z', '12:00am'],
  ['2026-11-05T12:00:00Z', '12:00pm'],
  ['2026-11-05T17:30:00Z', '5:30pm'],
  ['2026-07-01T17:30:00Z', '6:30pm'],
])('formats %s using the UK 12-hour clock', (value, expected) => {
  expect(clockTime(value)).toBe(expected);
});

it('keeps both meridiems when a range crosses noon or midnight', () => {
  expect(formatTimeRange('2026-11-05T11:30:00Z', '2026-11-05T12:30:00Z')).toBe('11:30am – 12:30pm');
  expect(halfHourRange('2026-11-05T23:30:00Z')).toBe('11:30pm – 12:00am');
});

it('uses the actual UK offset for half-hours across daylight saving changes', () => {
  expect(halfHourRange('2026-03-29T00:30:00Z')).toBe('12:30am – 2:00am');
  expect(clockTime('2026-10-25T00:30:00Z', true)).toBe('1:30am BST');
  expect(clockTime('2026-10-25T01:30:00Z', true)).toBe('1:30am GMT');
});

it.each([
  ['2026-11-07', '7 Nov 2026'],
  ['2026-01-01', '1 Jan 2026'],
  ['2024-02-29', '29 Feb 2024'],
  ['2026-07-01T23:30:00Z', '2 Jul 2026'],
  ['2026-11-07T00:30:00+02:00', '6 Nov 2026'],
])('formats %s as a consistent display date', (value, expected) => {
  expect(formatDate(value)).toBe(expected);
});
