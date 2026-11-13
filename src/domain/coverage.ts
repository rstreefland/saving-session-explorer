import { decimal, type Decimal } from './decimal';
import {
  midnight,
  Temporal,
  milliseconds,
  instantString,
  addMilliseconds,
  roundHalfHour,
} from './time';
import { indexReadings } from './calculate';
import type { Dataset } from './types';

const HALF_HOUR = 1_800_000;
// App heuristic based on Octopus's advice to query gaps lasting more than a week.
// Not a DCC delivery deadline; late readings can still replace any gap.
export const PRESUMED_MISSING_AFTER = 604_800_000;
export interface ReadingGap {
  status: 'pending' | 'presumed missing';
  start: string;
  end: string;
  count: number;
  meters: string;
  homeMiniCount: number;
}

/** Completed UTC intervals in the selected UK calendar window, including DST days. */
export function readingCoverage(
  data: Dataset,
  from: string,
  to: string,
  now = Temporal.Now.instant().epochMilliseconds,
) {
  const start = midnight(from).epochMilliseconds;
  const rangeEnd = midnight(to).add({ days: 1 }).epochMilliseconds;
  const completed = roundHalfHour(now, 'floor');
  const end = rangeEnd < completed ? rangeEnd : completed;
  const imports = indexReadings(data.imports);
  const standardImports = indexReadings(data.imports.filter((r) => r.source !== 'home-mini'));
  const exports = data.exports === null ? null : indexReadings(data.exports);
  const gaps: (Omit<ReadingGap, 'count' | 'homeMiniCount'> & {
    count: Decimal;
    homeMiniCount: Decimal;
  })[] = [];
  let expected = decimal(0),
    missing = decimal(0);

  for (let t = start; t < end; t = addMilliseconds(t, HALF_HOUR)) {
    expected = expected.plus(1);
    if (imports.get(t) == null || (exports !== null && exports.get(t) == null))
      missing = missing.plus(1);
    const needsImport = standardImports.get(t) == null;
    const needsExport = exports !== null && exports.get(t) == null;
    if (!needsImport && !needsExport) continue;
    const status =
      addMilliseconds(t, HALF_HOUR) <
      Temporal.Instant.fromEpochMilliseconds(now).subtract({ milliseconds: PRESUMED_MISSING_AFTER })
        .epochMilliseconds
        ? 'presumed missing'
        : 'pending';
    const homeMiniCount = needsImport && imports.get(t) != null ? 1 : 0;
    const meters =
      needsImport && needsExport ? 'import and export' : needsImport ? 'import' : 'export';
    const previous = gaps.at(-1);
    // Merge across dates and Mini availability, splitting only where status changes.
    if (previous && milliseconds(previous.end) === t && previous.status === status) {
      previous.homeMiniCount = previous.homeMiniCount.plus(homeMiniCount);
      if (previous.meters !== meters) previous.meters = 'import and export';
      previous.end = instantString(addMilliseconds(t, HALF_HOUR));
      previous.count = previous.count.plus(1);
    } else
      gaps.push({
        status,
        start: instantString(t),
        end: instantString(addMilliseconds(t, HALF_HOUR)),
        count: decimal(1),
        meters,
        homeMiniCount: decimal(homeMiniCount),
      });
  }
  // Counts are serialized for presentation; accumulated arithmetic stays Decimal.
  return {
    expected: expected.toNumber(),
    missing: missing.toNumber(),
    gaps: gaps.map((gap) => ({
      ...gap,
      count: gap.count.toNumber(),
      homeMiniCount: gap.homeMiniCount.toNumber(),
    })),
  };
}
