import { midnight, Temporal } from './time';
import { indexReadings } from './calculate';
import type { Dataset } from './types';

/** Count all elapsed half-hours in the selected UK calendar window, including 46/50-slot DST days. */
export function readingCoverage(
  data: Dataset,
  from: string,
  to: string,
  now = Temporal.Now.instant().epochMilliseconds,
) {
  const start = midnight(from).epochMilliseconds;

  const end = Math.min(
    midnight(to).add({ days: 1 }).epochMilliseconds,
    Math.floor(now / 1_800_000) * 1_800_000,
  );

  const imports = indexReadings(data.imports),
    exports = data.exports === null ? null : indexReadings(data.exports);

  let expected = 0,
    missing = 0;

  for (let t = start; t < end; t += 1_800_000) {
    expected++;

    if (imports.get(t) == null || (exports !== null && exports.get(t) == null)) missing++;
  }

  return { expected, missing };
}
