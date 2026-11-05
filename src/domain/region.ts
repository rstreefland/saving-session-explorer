export type HolidayRegion = 'scotland' | 'england-and-wales';
/** Elexon GSP group identifiers; deliberately do not default unknown groups. */
export function inferHolidayRegion(gspGroupId: string): HolidayRegion | null {
  if (['_N', '_P'].includes(gspGroupId)) return 'scotland';
  if (['_A', '_B', '_C', '_D', '_E', '_F', '_G', '_H', '_J', '_K', '_L', '_M'].includes(gspGroupId))
    return 'england-and-wales';
  return null;
}
