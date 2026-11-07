import { Temporal, todayInLondon } from './time';

export type Preset = '30d';

export function last30Days(today = todayInLondon()) {
  return { from: today.subtract({ days: 29 }).toString(), to: today.toString() };
}

export function validRange(from: string, to: string) {
  try {
    const start = Temporal.PlainDate.from(from),
      end = Temporal.PlainDate.from(to);

    return (
      Temporal.PlainDate.compare(start, end) <= 0 &&
      start.until(end, { largestUnit: 'days' }).days < 366
    );
  } catch {
    return false;
  }
}
