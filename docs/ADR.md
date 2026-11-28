# Architecture decisions

High-level choices whose reversal would materially change the app. Coding rules live in
[AGENTS.md](../AGENTS.md); calculation assumptions live in [methodology.md](methodology.md).

## ADR-001: Browser-only, read-only access

- **Date:** 2026-11-08 · **Status:** Accepted
- **Decision:** Keep account access read-only and run the app entirely in the browser.
- **Rationale & consequences:** Avoids operating a backend that holds credentials or account data.
  Credentials stay in browser storage; readings and results stay in memory. A backend, analytics,
  persistent readings, or write operations require revisiting this decision.

## ADR-002: Temporal for all dates and times

- **Date:** 2026-11-08 · **Status:** Accepted; implemented
- **Decision:** Use `temporal-polyfill` (via `src/domain/time.ts`) exclusively, with no JavaScript
  `Date` usage.
- **Rationale & consequences:** UK clock changes separate calendar dates from elapsed intervals.
  One Temporal model avoids host-timezone bugs and mixed representations without patching globals.

## ADR-003: Decimal arithmetic throughout

- **Date:** 2026-11-08 · **Status:** Accepted; implemented
- **Decision:** Use `decimal.js-light` for all numeric arithmetic.
- **Rationale & consequences:** Prevents binary floating-point artefacts in baselines, deltas, and
  reward boundaries. Values remain `Decimal` until display or serialisation; precision and rounding
  rules are in [methodology.md](methodology.md).
