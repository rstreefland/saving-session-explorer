# Calculation methodology and evidence

The app estimates session usage and rewards from smart meter readings and published event rates,
then compares them with Octopus's results. Official results never fill gaps in calculated figures,
and a discrepancy does not prove underpayment. For upstream endpoints, meter selection, and
failure modes, see [api.md](api.md).

## Evidence levels

Passing tests alone never promote a rule to supplier-confirmed.

| Level                  | Meaning                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------- |
| **Supplier-confirmed** | Exact supplier source, verification date, and applicable rule period.              |
| **Implemented model**  | Implemented here with independently worked regression tests.                       |
| **Inferred**           | Empirical assumption matching checked accounts; still needs supplier confirmation. |
| **App policy**         | Support, safety, numerical, or display choice made by this app.                    |

## Supported sessions and date ranges

_App policy:_ [calculate.ts](../src/domain/calculate.ts), [dateRange.ts](../src/domain/dateRange.ts)

- Recognised types (`Power down`, `Power up`, `Happy Hours`) starting on or after **29 Nov 2024**.
- Aligned UTC half-hour boundaries, positive duration up to 24 elapsed hours, within one
  `Europe/London` calendar date.
- Custom date ranges cover up to 366 calendar dates.

## Power down and Power up

### Baseline dates

_Implemented model & app policy:_ [calculate.ts](../src/domain/calculate.ts),
[region.ts](../src/domain/region.ts), [calculate.test.ts](../src/domain/calculate.test.ts),
[client.test.ts](../src/api/client.test.ts)

- **Weekdays:** 10 eligible prior weekdays. **Weekends and bank holidays:** 4 eligible prior
  weekend days.
- Excludes bank holidays and known event days, searching back up to **60 days**.
- Selected _before_ inspecting readings, so missing data never substitutes older dates.
- Bank holiday region comes from the Octopus GSP group (`_N`/`_P` → Scotland; `_A`–`_M` excluding
  `_I` → England & Wales) using GOV.UK data; unknown groups fail closed unless overridden.
- Event-calendar completeness checks the API `eventCount` (not the oldest event date); incomplete
  counts block baseline estimates.

### Readings and net import

_Implemented model & app policy:_ [calculate.test.ts](../src/domain/calculate.test.ts),
[time.test.ts](../src/domain/time.test.ts), [client.test.ts](../src/api/client.test.ts)

- Matches each session half-hour to the same `Europe/London` wall time on each baseline date.
- Requires complete, aligned half-hours. Zero is valid; invalid, duplicate, conflicting, ambiguous,
  or nonexistent clock-change times are rejected rather than guessed.
- Uses **import minus linked export**. Missing linked-export readings block the estimate; having no
  linked export meter is treated as zero export. Meter serials are never mixed.

### Qualifying change per half-hour

_Implemented model:_ `calculates turn up and clips each half-hour separately` and
`calculates a bank holiday from four known weekend days, not weekday usage` in
[calculate.test.ts](../src/domain/calculate.test.ts)

Qualifying energy is clipped at zero **per half-hour** before summing:

- **Power down:** `max(baseline − actual, 0)`
- **Power up:** `max(actual − baseline, 0)`

Whole-session net change (`baseline − actual`) is kept separate, so a shift in the wrong direction
in one half-hour does not cancel a qualifying shift in another.

- **Bank holiday example (Power down):** four weekend days supply 1, 2, 3, and 4 kWh/slot (mean
  2.5 kWh). A two-slot session using 0.5 kWh/slot has 5 kWh baseline, 1 kWh actual, and **4 kWh**
  qualifying reduction. Removing one reference day's readings makes the baseline unavailable
  without changing the selected dates.
- **Clipping example (Power up):** two 0.6 kWh baseline slots with actuals of 1.6 and 0.15 kWh give
  qualifying increases of 1 and 0 kWh (**1 kWh** rewarded; whole-session `baseline − actual` is
  **−0.55 kWh**).

## Happy Hours

_Implemented model & app policy:_ `does not clip imported usage to the reward cap or subtract export`
in [calculate.test.ts](../src/domain/calculate.test.ts)

- Sums **imported** half-hourly kWh only (no baseline, no export subtraction).
- Does not clip usage to a reward-cap figure and does not price the cash bill credit.
- **Example:** two 10 kWh import slots yield **20 kWh** even with 1 kWh/slot export and a 16 kWh
  reward cap.

## Reward estimation

_Inferred (Power down) & app policy:_ [points.ts](../src/domain/points.ts),
[points.test.ts](../src/domain/points.test.ts)

- **Power down:** multiplies qualifying kWh by the published Octopoints/kWh rate (capped at
  `Number.MAX_SAFE_INTEGER − 8` raw points). Under the **inferred** model (`8 points = 1p`), raw
  points round **up once** to a whole penny, with an assumed **16-point (2p) minimum** for any
  positive reward. Zero earns zero. Rounding and the minimum still need supplier confirmation.
- **Power up:** energy only; tariff inputs needed to price rewards are absent.
- **Happy Hours:** bill credit, not independently priced.

Independently worked Power down examples (`estimates %s kWh at %s points/kWh without rounding
energy first` and `does not award minimum points for floating-point noise in identical baseline and
session readings` in [points.test.ts](../src/domain/points.test.ts)):

| Qualifying kWh | Rate (pts/kWh) | Raw points | Penny-rounded | Estimated reward |
| -------------- | -------------- | ---------- | ------------- | ---------------- |
| `0.21`         | `80`           | `16.8`     | `24` (3p)     | **24 pts**       |
| `0.1471`       | `16`           | `2.3536`   | `8` (1p)      | **16 pts** (min) |
| `0.3`          | `80`           | `24`       | `24` (3p)     | **24 pts**       |
| `0.300001`     | `80`           | `24.00008` | `32` (4p)     | **32 pts**       |
| `0`            | any            | `0`        | `0`           | **0 pts**        |

## Missing data, Home Mini, and blockers

_App policy:_ [coverage.ts](../src/domain/coverage.ts), [homeMini.ts](../src/api/homeMini.ts),
[calculate.test.ts](../src/domain/calculate.test.ts), [outcome.test.ts](../src/domain/outcome.test.ts)

- **Presumed missing:** completed gaps older than **7 days** (heuristic, not a supplier deadline;
  late readings still replace them). Future intervals are excluded.
- **Home Mini fallback:** fills _absent_ import intervals only within a **29-day (696-hour)**
  rolling window, matching both MPAN and serial and converting Wh → kWh. Never overwrites an
  existing standard row, even an invalid one.
- **Provisional estimates:** any Mini reading in session or baseline data marks the estimate
  provisional and suppresses missed-reward alerts; refreshing allows standard readings to replace
  fallback data.
- **Blockers vs warnings:** failed bank-holiday, linked-export, or event-history lookups block
  Power down/up baselines while leaving Happy Hours usable. Informational warnings never change
  eligibility.

## Comparing with Octopus results

_API interpretation & app policy:_ [session.ts](../src/domain/session.ts),
[outcome.ts](../src/domain/outcome.ts), [calculate.test.ts](../src/domain/calculate.test.ts),
[points.test.ts](../src/domain/points.test.ts)

- **Publication:** pending results stay pending (a pending zero may be a placeholder). Energy and
  points publication are handled separately.
- **Energy mismatch:** `|calculated − official| > 0.01 kWh` flags a mismatch (`0.01 kWh` exact is a
  match). Baseline or actual deltas above `0.01 kWh` also flag a mismatch (app policy, not a
  supplier tolerance).
- **Outcomes & alerts:** Power down/up counts as achieved when qualifying energy `> 0.000000001`
  kWh (`Achieved` if whole-session net shift is also `> 0.000000001` kWh in the target direction,
  otherwise `Partly achieved`). **Possible missed reward** fires only for non-provisional achieved
  sessions where Octopus returned `FAIL` with zero/null points or `MISSING_READINGS` with zero
  points.

## Precision and rounding

_App policy:_ [ADR-003](ADR.md), [decimal.ts](../src/domain/decimal.ts),
[numericSchema.ts](../src/api/numericSchema.ts), [decimal.test.ts](../src/domain/decimal.test.ts),
[numericSchema.test.ts](../src/api/numericSchema.test.ts), [client.test.ts](../src/api/client.test.ts)

- **Arithmetic:** one `decimal.js-light` instance at **40 significant digits** (truncating beyond
  40). Divisions by `4`, `10`, `1,000`, and `8` terminate cleanly within 40 digits for ordinary
  inputs.
- **Boundaries:** Zod validates finite numbers and decimal strings at API entry points, preserving
  supplied strings (raw JSON numbers are already parsed by the browser). Out-of-range values are
  rejected. Cached datasets stay plain serialisable values; calculated figures stay `Decimal`
  through comparison and rendering.
- **Display rounding (half-up):** **2 dp** summaries, **3 dp** readings, up to **6 dp** points
  breakdowns, with `en-GB` grouping without binary `Number` conversion. Change colours stay neutral
  when `|change| < 0.000000001` kWh (independent of reward rounding).
- **Exact boundaries (no binary epsilon guards):**
  - Five `0.100` + five `0.101` kWh readings average to `0.1005` (displayed `0.101`); `1.005`
    displays as `1.01` at 2 dp.
  - `0.3000000000000001 kWh × 80` = `24.000000000000008` → rounds up to `32` pts;
    `0.0000000000000001 kWh × 80` → `8` pts, raised to the `16`-pt minimum.
  - `|difference| = 0.0100000001 kWh` is a mismatch; `0.01 kWh` exact is a match.
  - Full Temporal nanosecond alignment (`00:00:00.000000001Z` is rejected).
  - `100.00000000000001 Wh ÷ 1,000` stays `0.10000000000000001 kWh`.

## Visible-history totals and overview

_App policy:_ [totals.ts](../src/domain/totals.ts), [totals.test.ts](../src/domain/totals.test.ts)

- Each column sums independently over the visible session type and date range, excluding
  unavailable and pending values (never zeroing them), so Calculated and Octopus columns may cover
  different sessions.
- Rewards sum already-rounded per-session awards without repricing. An Octopus average credit on a
  `MISSING_READINGS` session still contributes to the official reward total.
- The overview mirrors row outcomes: calculated achievements include `Achieved` and `Partly
achieved`; official achievements count published `SUCCESS` and `PARTIAL_SUCCESS` (with published
  `FAIL` as available non-achievement). Pending, missing-reading, upcoming, and unavailable counts
  are tracked separately; provisional inputs mark affected totals and never raise missed-reward
  alerts.

## Updating evidence

1. Record the supplier source and verification date before promoting any rule.
2. Update a minimal, anonymous contract fixture (preserve malformed/optional edge cases; strip all
   credentials, account IDs, addresses, names, and meter identifiers; fail unexpected network
   calls).
3. Revise independently worked examples _before_ changing the calculator; never generate expected
   values from the implementation.
