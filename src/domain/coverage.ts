import { midnight, Temporal } from './time';
import { indexReadings } from './calculate';
import type { Dataset } from './types';

const HALF_HOUR = 1_800_000;
// App heuristic based on Octopus's advice to query gaps lasting more than a week.
// Not a DCC delivery deadline; late readings can still replace any gap.
export const PRESUMED_MISSING_AFTER = 7 * 86_400_000;
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
  const end = Math.min(
    midnight(to).add({ days: 1 }).epochMilliseconds,
    Math.floor(now / HALF_HOUR) * HALF_HOUR,
  );
  const imports = indexReadings(data.imports);
  const standardImports = indexReadings(data.imports.filter((r) => r.source !== 'home-mini'));
  const exports = data.exports === null ? null : indexReadings(data.exports);
  const gaps: ReadingGap[] = [];
  let expected = 0,
    missing = 0;

  for (let t = start; t < end; t += HALF_HOUR) {
    expected++;
    if (imports.get(t) == null || (exports !== null && exports.get(t) == null)) missing++;
    const needsImport = standardImports.get(t) == null;
    const needsExport = exports !== null && exports.get(t) == null;
    if (!needsImport && !needsExport) continue;
    const status = t + HALF_HOUR < now - PRESUMED_MISSING_AFTER ? 'presumed missing' : 'pending';
    const homeMiniCount = needsImport && imports.get(t) != null ? 1 : 0;
    const meters =
      needsImport && needsExport ? 'import and export' : needsImport ? 'import' : 'export';
    const previous = gaps.at(-1);
    // Merge across dates and Mini availability, splitting only where status changes.
    if (previous && Date.parse(previous.end) === t && previous.status === status) {
      previous.homeMiniCount += homeMiniCount;
      if (previous.meters !== meters) previous.meters = 'import and export';
      previous.end = new Date(t + HALF_HOUR).toISOString();
      previous.count++;
    } else
      gaps.push({
        status,
        start: new Date(t).toISOString(),
        end: new Date(t + HALF_HOUR).toISOString(),
        count: 1,
        meters,
        homeMiniCount,
      });
  }
  return { expected, missing, gaps };
}
