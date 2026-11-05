import { Temporal } from '@js-temporal/polyfill';

// Import explicitly rather than patching globals, for consistent browser and test support.
export { Temporal };
export const ZONE = 'Europe/London';
export const local = (iso: string) => Temporal.Instant.from(iso).toZonedDateTimeISO(ZONE);
export const day = (iso: string) => local(iso).toPlainDate().toString();
export const midnight = (date: string) => Temporal.PlainDate.from(date).toZonedDateTime(ZONE);
export const milliseconds = (iso: string) => Temporal.Instant.from(iso).epochMilliseconds;
export const iso = (time: Temporal.ZonedDateTime) => time.toString({ timeZoneName: 'never' });
export const todayInLondon = () => Temporal.Now.plainDateISO(ZONE);
export const clockTime = (value: string) =>
  local(value).toPlainTime().toString({ smallestUnit: 'minute' });
export const formatLocal = (value: string, options: Intl.DateTimeFormatOptions) =>
  local(value).toLocaleString('en-GB', options);

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
