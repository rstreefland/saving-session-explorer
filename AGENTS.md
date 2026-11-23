# Repository working agreement

Small, browser-only app comparing smart meter estimates with Octopus Saving Session results — keep
complexity proportional. Rules apply to all contributors, code, tests, and tooling unless noted.

## Before changing code

- Read relevant code, tests, and [docs/ADR.md](docs/ADR.md); for calculation or API changes, also
  read [docs/methodology.md](docs/methodology.md) and [docs/api.md](docs/api.md).
- Inspect `git status` and existing diffs first. Preserve others' work; never reset, clean,
  overwrite, or revert unrelated changes.
- Keep changes focused (no incidental upgrades, broad reformatting, or unrelated refactors). Check
  git history and regression tests before altering previously fixed behaviour.
- Update every affected consumer (responsive layouts, tooltips, explanations) and keep intentional
  differences explicit.
- Follow these standards in all new/changed code. Don't copy existing violations; migrate the
  coherent affected path and report remaining gaps instead of rewriting the repo. ADR status
  distinguishes accepted decisions from completed migrations.

## Dates and times

- **Temporal only — never use JavaScript `Date`** (`new Date`, `Date.now`, `Date.parse`, or test
  fixtures). Import `temporal-polyfill` explicitly via `src/domain/time.ts`; never patch globals.
- Use Temporal arithmetic, `Europe/London` civil dates for calendar rules, and instants for elapsed
  intervals. Preserve half-open intervals and reject ambiguous/nonexistent reference times (local
  days are not always 24 hours).
- **Reuse existing display formats** (`7 Nov 2026`, `5:30pm`, `5:30pm – 6:00pm` in
  `en-GB`/`Europe/London`, plus the existing zone-qualified form). Ask the user before adding or
  changing a format, with a concrete example and rationale. Keep ISO transport values and native
  date inputs machine-formatted, and keep display formatting in shared helpers with regression
  tests.

## Numbers, types, and validation

- **Use `decimal.js-light` for all numeric arithmetic** (including tests and tooling); never
  compute with native arithmetic or `Math` and wrap afterward. Preserve decimal strings at
  boundaries; keep `Decimal` through calculations/comparisons and convert only at display,
  serialisation, or library boundaries. Centralise precision/rounding config, document it in
  [docs/methodology.md](docs/methodology.md), and test boundary cases (including division).
- **No type casts or assertions outside tests** (`as T`, double casts, angle-bracket casts,
  `as const`, `any`, `!`, or TS suppression comments). Use inference, annotations, discriminated
  unions, narrowing, or `satisfies`. Tests may use assertions for fixtures/mocks when needed.
- **Validate all unknown input with Zod at entry points** (API, parsed JSON, storage) once before
  passing typed data inward. Separate required fields from optional enrichment; never silently
  default malformed values. Keep Zod JIT-free (`z.config({ jitless: true })`) for production CSP.
- Follow strict TypeScript and repo Prettier settings. Use `npm` and keep `package.json` and
  `package-lock.json` in sync. Prefer existing libraries/UI primitives; never edit generated output.

## Architecture

- Keep API code in focused modules (transport, auth, schemas, discovery, dataset assembly) behind
  **one readable loading orchestrator**. Use direct functions and explicit data flow (no generic
  pipeline framework); prevent import cycles.
- Keep domain calculations independent of React, network, and storage.
- **Single state ownership:** `useSessionData` owns server state, account-scoped caching, and
  cancellation; `App` owns selected dates/type, filters, and sorts once; history and summaries
  share those visible results. No competing fetches, caches, sorts, or calculations in components.
- **Consolidate availability into a small typed set of domain causes** and derive eligibility,
  summary state, outcome codes, and messages from them. Keep provenance and publication status
  explicit, keep informational warnings separate from blockers, keep precedence deterministic, and
  don't add parallel flags, reason strings, or labels for existing conditions.
- Handle uncertainty at boundaries and encode valid states in types. Add defensive branches only
  for demonstrated failures (with examples); don't re-check upstream guarantees. Optional failures
  disable only dependent capabilities.
- Extract shared logic only to remove real duplication or disagreement; avoid arbitrary file
  limits, speculative extensibility, and pass-through layers.

## Result integrity

- **Missing ≠ zero:** keep unknown readings, valid zeroes, absent export meters, failed export
  loads, pending results, and published zero rewards distinct.
- Select baseline dates before inspecting readings; never substitute older dates to hide gaps.
  Reject invalid, duplicate, conflicting, or misaligned half-hours without guessing or
  interpolating.
- Preserve per-type methodology (Power down/up: net import + per-half-hour qualifying change; Happy
  Hours: import only). Keep unsupported cases explicit and future sessions inspectable without
  inventing readings. Verify event-calendar completeness from API counts, not the oldest event
  date. Align UI and request date-range rules.
- Select meters deterministically from usable data and re-evaluate on refresh; never mix histories
  across serials or turn failed discovery into an absent meter.
- **Home Mini:** fill absent import intervals only, match both MPAN and serial, use completed
  aligned intervals within bounded history, and never overwrite standard rows. Carry provisional
  provenance through baseline/session calculations and suppress missed-reward alerts for
  provisional estimates; refresh lets standard data replace fallbacks.
- Estimate independently of official outcomes; centralise reward arithmetic and round at the
  specified stage. Separate supplier evidence, inferred rules, and app heuristics in docs; never
  claim discrepancies prove underpayment.

## Account safety

- Keep credentials and personal account data out of logs, raw error messages, query keys, public
  HTML, committed fixtures, screenshots, and recordings. Results and readings stay in memory.
- Any backend, analytics, persistent readings, credential-storage change, or write operation
  requires an explicit product decision in [docs/ADR.md](docs/ADR.md).
- Account changes clear account-scoped data and cancel in-flight work. Forgetting disconnects and
  clears memory even if storage removal fails; attempt all removals and surface storage errors.
  Late responses must never restore stale or previous-account results.

## Requests, cancellation, and security

- Pass `AbortSignal` through every request and optional dependency; rethrow cancellations rather
  than converting them to warnings or partial results. Clean up effects, subscriptions, and timers
  under React Strict Mode.
- Encode path parameters and constrain authenticated pagination (host prefix, loop detection, max
  pages). Keep retries/refreshes deliberate; keep Home Mini requests sequential and retain partial
  successful days on failure; avoid background fetch or retry storms.
- Preserve production CSP, bundled scripts/fonts, and restricted network origins. Keep GitHub
  Actions pinned to commit SHAs, permissions minimal, `persist-credentials: false`, and Playwright
  package/container versions aligned.

## UI consistency

- Drive behaviour from domain codes, never display labels. Reuse shared numeric formatting,
  placeholders, Octopoints rendering, provenance indicators, and explanations; preserve deliberate
  summary vs detail precision differences.
- Keep mobile, compact, and desktop layouts equivalent in values, statuses, and detail access.
  Update CSS/JS breakpoints, columns, and expanded spans together; retain expansion state across
  resizes.
- Give styles a clear owner via shared tokens and feature stylesheets; edit the owning rule rather
  than appending overrides.
- **Typography:** strictly `14px` primary text and `12px` secondary text across all breakpoints
  (only the main title may resize responsively). Keep overview/history body text at weight `400`,
  with numbers and units the same size; reuse shared size tokens.
- **Accessibility:** semantic controls, accessible names, keyboard support, focus, disclosure
  state, adequate touch targets, reduced motion, and keyboard/touch tooltips. Supplement
  interaction tests with automated accessibility checks.
- Keep the static and interactive public intro shared and account-free. When hosting or preview
  assets change, sync canonical/social URLs, `robots.txt`, `sitemap.xml`, `CNAME`, and
  `social-card.svg` with `social-card.png`.

## Tests and verification

- **Browser tests:** [Vitest Browser Mode](https://vitest.dev/guide/browser/) with Playwright
  (Chromium + WebKit) and native locators/assertions. Run production CSP and JS-disabled checks via
  browser commands on a fresh build. Keep calculation/content assertions in unit tests; use browser
  tests for layout, interactions, and production behaviour. Don't duplicate across nearby
  viewports; don't add standalone Playwright test runner tests.
- Prefer small, anonymous API contract fixtures and independently worked end-to-end examples
  (session types, missing data, publication, export, DST, provisional inputs, rounding). Never
  generate expected outputs from the implementation; update examples when APIs or methodology
  change.
- Test at the failing boundary (API/account changes need `App` with intercepted requests plus
  focused hook tests). Test observable UI behaviour, not implementation mirrors.
- Keep fixtures synthetic/anonymised, minimal, and free of credentials or account IDs. Intercept
  network requests and fail unexpected external calls; disable recordings; control Temporal clocks
  and restore mocks.
- **Before handoff:** run formatting and relevant tests, plus `npm run build` for code/config
  changes. For layout, CSP, or public-content changes, test a fresh production build in Chromium
  and WebKit (wait for fonts before measuring). Doc-only changes need formatting and link checks
  only.
- Never lower CI thresholds, disable failing tests, or inflate timeouts to pass. Report checks run,
  failures, and gaps. Remove redundant tests only when behavioural coverage is clearly preserved.

## Development commands

Use Node 24 and npm 10+ (matching CI; the broader `engines` range in `package.json` is not tested).

```sh
npm ci
npm test -- src/domain/calculate.test.ts
npm run format:check
npm run test:coverage -- --maxWorkers=1
npm run build
npx playwright install --with-deps chromium webkit
npm run typecheck:browser
npm run test:browser:build
```

- `typecheck:browser` is separate from `npm run build`.
- Pushing to `main` deploys GitHub Pages without waiting for the separate browser checks workflow;
  don't claim otherwise or change deployment gating incidentally.

## Documentation and decisions

- **[README.md](README.md):** lightweight — purpose, quick start, essential privacy/limits, links.
  No feature announcements or per-feature edits.
- **[docs/ADR.md](docs/ADR.md):** short, high-level architectural choices only (ID, date, status,
  decision, rationale, consequences). Preserve superseded decisions and link replacements. No
  coding rules, refactors, test policies, or task lists.
- **[docs/methodology.md](docs/methodology.md):** calculation assumptions, evidence levels, and
  worked examples. Update explanations and tests with methodology changes; promote rules to
  supplier-confirmed only with an exact source and verification date.
- **[docs/api.md](docs/api.md):** external endpoints, authentication, meter discovery, fallback
  rules, and failure modes. Update alongside API or CSP changes.
- Keep private local research git-ignored; never force-add it. Make intentional standards changes
  explicit here instead of adding silent exceptions in code.
