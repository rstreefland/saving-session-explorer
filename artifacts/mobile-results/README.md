# Mobile results exploration

Branch: `explore/mobile-results`, based on `origin/main` at `e8f7566`.

**Selected: B, comparison cards.** Cards are now the default at widths up to 600px; the exploration selector and alternate layouts have been removed. The screenshots below document the original exploration, before shortening “Awaiting meter readings” to “Awaiting readings”.

Original prototype URLs (historical):

- `/?mobile-results=list`: stacked list, with a separate row for each source.
- `/?mobile-results=cards`: cards comparing both sources side by side.
- `/?mobile-results=compact`: reward-first list; expanding reveals the comparison and readings.

Choose **Try demo** at the normal URL to see the selected cards. Desktop retains the table.

Screenshots use identical demo data at 393 × 852 CSS pixels (iPhone 16 portrait),
at 2× capture scale. These are browser viewport checks, not physical-device tests.
The screenshots start at the results list to prioritize the design differences.

Recommendation: comparison cards give the clearest estimated-versus-official comparison.
The compact list is preferable when scanning many sessions matters more than comparing figures.

Validation: production build, unit suite, and `tests/browser/mobile-results.spec.ts`
(Chromium and WebKit). The browser test checks session types, expanded details,
44px controls, viewport overflow, and the desktop table.
