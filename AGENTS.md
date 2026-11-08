# Repository working agreement

This is a small, browser-only app for comparing independent energy estimates with Octopus
Saving Session results. Keep complexity proportional to that purpose. These rules apply to all
contributors and repository code, including tests and tooling unless an exception is stated.

## Before making changes

- Read the relevant code, tests, and [decisions](docs/ADR.md). For calculation or upstream-data
  changes, also read [methodology](docs/methodology.md).
- Inspect git status and the existing diff. Preserve other contributors' work and coordinate
  overlapping edits. Never reset, clean, overwrite, or revert unrelated changes.
- Keep changes focused. Avoid incidental dependency upgrades, broad formatting, and unrelated
  refactors. Check history and regression tests before changing a previously corrected behavior.
- Apply corrections to every affected consumer, including responsive layouts and explanations.
  Identify intentional differences rather than letting implementations drift.
- New and changed code must follow these standards. Existing violations are migration work,
  not examples to copy. Migrate a coherent affected path and report remaining gaps; do not turn
  a local task into an unrequested repository rewrite. ADR status distinguishes accepted
  decisions from completed migrations.

## Mandatory language and data rules

- **Use Temporal exclusively for dates and times. Never use JavaScript `Date`**, including
  `new Date`, `Date.now`, `Date.parse`, and test fixtures. Use the explicit `temporal-polyfill`
  import and shared helpers in `src/domain/time.ts`; do not patch application globals.
  Use Temporal operations for date/time arithmetic, London civil dates for calendar rules,
  and instants for elapsed intervals. Preserve half-open intervals and reject ambiguous or
  nonexistent reference times; a local day is not necessarily 24 hours.
- **Reuse established date/time formats. Ask the user for permission before introducing a new
  variant or changing an existing one.** Show a concrete example and why the existing helper
  is insufficient. Current formats are `7 Nov 2026`, `5:30pm`, and `5:30pm – 6:00pm`, using
  `en-GB` and `Europe/London`; use the existing zone-qualified form when needed. ISO transport
  values and native date-input values remain machine formats. Keep display formatting in
  shared helpers, with regression examples.
- **Use `decimal.js-light` for all numeric arithmetic**, including tests and tooling, not only
  money. Do not compute with native numeric arithmetic or `Math` and wrap the result afterward.
  Date/time arithmetic belongs to Temporal. Preserve decimal strings at input boundaries where
  supplied; keep Decimal values through calculations and comparisons, converting only at explicit
  display/serialization or library boundaries. Centralize precision and rounding configuration,
  document it in the methodology, and test boundary cases. Decimal division still needs a deliberate
  precision policy. See ADR-004 for migration status.
- **No type casts/assertions outside test code.** This includes `as T`, double assertions,
  angle-bracket assertions, and `as const`. Use inference, annotations, discriminated unions,
  narrowing, or `satisfies`. Do not bypass this rule with `any`, non-null assertions, or TypeScript
  suppression comments. Test assertions are allowed for fixtures/mocks when needed.
- **Use Zod to validate data of unknown types** at entry points: API responses, parsed JSON,
  stored data, and other untrusted input. Parse once before passing typed values inward.
  Distinguish required fields from optional enrichment; do not cast away uncertainty or silently
  default malformed values. Keep Zod's JIT-free configuration compatible with production CSP.
- Follow strict TypeScript and the existing Prettier configuration. Use npm and its lockfile;
  update manifests and lockfiles together. Prefer existing libraries and UI primitives before
  adding another state manager, styling system, or abstraction. Do not edit generated output.

## Architecture: reduce coordination and duplicated state

- Separate transport, authentication, schemas, discovery, and dataset assembly into a few focused
  API modules, with **one readable loading orchestrator**. Use direct functions and explicit data
  flow, without a generic pipeline framework. Prevent new import cycles; resolve the existing
  `client.ts`/`homeMini.ts` cycle when changing that boundary.
- Keep calculations and semantic decisions independent of React, network, and storage. The current
  `domain/storage.ts` adapter is a placement exception, not permission to add storage to calculations.
- `useSessionData` owns server state, account-scoped caching, and cancellation. `App` owns selected
  dates/type and filters/sorts once. History and summaries consume the same visible results.
  Components must not introduce competing fetching, caches, sorting, or calculations.
- **Simplify availability into a small typed set of domain causes.** Derive eligibility, summary
  state, outcome codes, and presentation messages from those causes. Keep provenance and official
  publication status explicit where they express different facts. Do not add another independently
  maintained flag, reason string, or label for an existing condition. The current `baselineIssues`,
  `issues`, `unavailableReason`, and `state` overlap is migration debt, not a required design.
  Preserve behavior while consolidating it; keep informational warnings separate from blockers
  and make precedence deterministic.
- Handle uncertainty at boundaries and encode valid states in types. Add defensive branches for
  demonstrated inputs/failures, with focused examples; avoid repeating checks for guarantees already
  established upstream. Optional failures disable only capabilities that require the missing data.
- Extract shared logic when it removes actual duplication or disagreement. Avoid arbitrary file
  limits, speculative extensibility, and layers that merely forward calls.

## Result integrity

- Missing is not zero. Keep unknown readings, valid zeroes, absent export meters, failed export
  loading, pending results, and published zero rewards distinct.
- Select eligible baseline dates before inspecting readings. Never substitute older dates to hide
  gaps. Reject invalid, duplicate, conflicting, or misaligned half-hours; do not guess or interpolate.
- Preserve each session type's methodology. Power down/up use net import and qualifying changes
  per half-hour; Happy Hours use import only. Keep unsupported cases explicit and future sessions
  inspectable without inventing future readings. Check event-calendar completeness from API counts,
  not the oldest event date. Keep date-range rules consistent between the UI and requests.
- Select meters deterministically from usable data and reevaluate candidates on refresh. Never
  combine histories from different serials or turn failed discovery into an absent meter.
- Home Mini fills absent import intervals only, matches both MPAN and serial, uses completed
  aligned intervals within its bounded history, and never overwrites an existing standard row.
  Carry provisional provenance through baseline and session calculations; suppress missed-reward
  alerts for provisional estimates. Refresh allows standard readings to replace fallback inputs.
- Derive estimates from readings and published rates independently of official outcomes. Centralize
  reward arithmetic and round at the specified stage. Document supplier evidence, inferred rules,
  and app heuristics separately; never present discrepancies as proof of incorrect settlement.

## Account safety and asynchronous work

- Keep credentials and personal account data out of logs, raw error messages, query keys, public
  HTML, committed fixtures, screenshots, and recordings. Results/readings stay in memory.
  A backend, analytics, persistent readings, credential-storage changes, or account-changing
  operations require an explicit product decision, recorded in the ADR.
- Account changes clear account-scoped data and cancel work. Forgetting must disconnect and clear
  memory even if storage removal fails; attempt all removals and show the storage failure.
  Late responses must never restore stale or previous-account results.
- Pass cancellation through every request and optional dependency. Rethrow cancellation rather
  than converting it to a warning or successful partial result. Clean up effects, subscriptions,
  and timers; preserve correct behavior under React Strict Mode.
- Encode path parameters and constrain authenticated pagination destinations, loops, and page
  counts. Preserve deliberate retry/refresh behavior. Mini requests remain sequential and retain
  successful partial work after a failure; avoid incidental background fetching or retry storms.
- Preserve production CSP, bundled scripts/fonts, and restricted network destinations. Review
  implications before changing those constraints. Keep GitHub Actions pinned, permissions minimal,
  checkout credentials unpersisted, and Playwright package/container versions aligned.

## UI consistency

- Base behavior on domain codes, never display labels. Reuse shared numeric formatting,
  placeholders, Octopoints, provenance indicators, and explanations. Keep deliberate precision
  differences between summaries and detailed readings.
- Mobile, compact, and desktop layouts must show equivalent values, statuses, and access to
  details. Change CSS/JavaScript breakpoints, columns, and expanded spans together; retain
  expansion state across resizing.
- Give styles a clear owner. Use shared tokens and feature stylesheets; edit the owning rule
  rather than appending overrides elsewhere. Preserve established typography relationships.
- Use semantic controls with accessible names, keyboard operation, focus, disclosure state,
  adequate touch targets, and reduced-motion support. Tooltips must work with keyboard and touch.
  Automated accessibility checks supplement interaction tests.
- Keep the static and interactive public introduction shared and account-free. When hosting or
  preview assets change, synchronize canonical/social URLs, robots, sitemap, CNAME, and the
  editable sharing-card source with its published image.

## Verification proportional to risk

- Prefer a small set of representative, anonymous API contract fixtures and independently worked
  end-to-end calculation examples. Cover supported session types, missing data, publication,
  export, DST, provisional inputs, and rounding where relevant. Expected results must not be
  generated by the implementation being tested. Revisit these examples when APIs or methodology
  change; coverage percentages do not establish agreement with Octopus.
- Test corrected behavior at the boundary that can fail. API/account changes need the normal
  `App` with intercepted requests as well as focused hook tests. Test observable UI behavior;
  avoid tests that merely mirror implementation or duplicate existing evidence.
- Keep fixtures synthetic or thoroughly anonymized, minimal, and free of credentials and account
  identifiers. Intercept network requests and fail unexpected external calls. Keep recordings
  disabled. Control the relevant Temporal clock and restore mocks; do not add `Date` fixtures.
- Run targeted checks during development. Before handoff, run formatting and relevant tests;
  build for code/configuration changes. For layout, CSP, or public-content changes, use a fresh
  production build and both Chromium and WebKit. Wait for fonts before layout measurements.
  Documentation-only changes need formatting/link checks, not application test runs.
- CI runs formatting, coverage, build, and browser checks. Never lower thresholds, disable failing
  tests, or inflate timeouts merely to get green. Report checks actually run, failures, and gaps.
  Remove redundant tests only when equivalent behavioral coverage is clear.

Use Node 24 and npm 10+ for development, matching CI. The broader Node range in `package.json`
does not establish that older versions are tested. Commands:

```sh
npm ci
npm test -- src/domain/calculate.test.ts
npm run format:check
npm run test:coverage -- --maxWorkers=1
npm run build
npx playwright install --with-deps chromium webkit
npm run test:browser:build
```

Explicit browser-test type checking is a follow-up, not a check the current build provides.
Pushing to `main` deploys. Pages does not currently wait for the separate browser checks;
do not claim otherwise or change deployment gating incidentally.

## Documentation and decisions

- Keep [README.md](README.md) lightweight: purpose, quick start, essential privacy/limitations,
  and links. Do not append feature announcements or edit it for every feature.
- Keep [docs/ADR.md](docs/ADR.md) short and high level. Record only significant architectural
  choices whose reversal would materially change the app: ID, date, status, decision, rationale,
  and consequences. Coding conventions, routine refactors, test policies, and task lists do not
  belong there. Preserve genuine architectural decisions when superseded and link replacements.
- Keep calculation assumptions, evidence classification, and focused examples in
  [docs/methodology.md](docs/methodology.md). Update affected explanations/tests with methodology
  changes. Promote a rule to supplier-confirmed only with an exact source and verification date.
- Only explicitly shared docs are tracked. Keep private local research ignored; never force-add
  it incidentally. Make intentional standards changes explicit in this guide rather than adding
  silent exceptions throughout the code.
