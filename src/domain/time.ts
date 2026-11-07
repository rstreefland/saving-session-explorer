import { Temporal } from 'temporal-polyfill';

// Import explicitly rather than patching globals, for consistent browser and test support.
export { Temporal };

export const ZONE = 'Europe/London';
export const local = (iso: string) => Temporal.Instant.from(iso).toZonedDateTimeISO(ZONE);
export const day = (iso: string) => local(iso).toPlainDate().toString();
export const midnight = (date: string) => Temporal.PlainDate.from(date).toZonedDateTime(ZONE);
export const milliseconds = (iso: string) => Temporal.Instant.from(iso).epochMilliseconds;
export const iso = (time: Temporal.ZonedDateTime) => time.toString({ timeZoneName: 'never' });
export const todayInLondon = () => Temporal.Now.plainDateISO(ZONE);

export const formatLocal = (value: string, options: Intl.DateTimeFormatOptions) =>
  local(value).toLocaleString('en-GB', options);

/** Calendar dates stay as written; timestamps use their UK local calendar date. */
export const formatDate = (value: string) =>
  Temporal.PlainDate.from(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : day(value)).toLocaleString(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  );

/** Display times consistently in UK local time, including across clock changes. */
export const clockTime = (value: string, includeZone = false) =>
  formatLocal(value, {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
    ...(includeZone ? { timeZoneName: 'short' } : {}),
  }).replace(/\s(?=[ap]m)/g, '');

export const formatTimeRange = (start: string, end: string) =>
  `${clockTime(start)} – ${clockTime(end)}`;

/** Reject both nonexistent spring times and repeated autumn times instead of guessing. */
export function referenceTime(date: string, time: Temporal.PlainTime): number | null {
  try {
    return Temporal.PlainDate.from(date)
      .toPlainDateTime(time)
      .toZonedDateTime(ZONE, { disambiguation: 'reject' }).epochMilliseconds;
  } catch (error) {
    if (error instanceof RangeError) return null;

    throw error;
  }
}
