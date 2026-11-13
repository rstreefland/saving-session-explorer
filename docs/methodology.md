# Calculation methodology and evidence

This describes the app's current model and its limits. It is not a reproduction or certification
of Octopus settlement. Independent estimates use readings and published event rates; official
results are comparison inputs, never substitutes for missing estimates. A discrepancy alone
does not establish underpayment.

## Evidence classes

- **Supplier-confirmed:** supported by an exact supplier source, verification date, and applicable
  session/rule period. A passing application test is not supplier confirmation.
- **Implemented model:** behavior encoded in this repository, with local regression evidence.
- **Inferred:** an empirical assumption whose supplier confirmation is outstanding.
- **App policy:** a deliberate safety, display, or support limit rather than a supplier rule.

The table below records implementation evidence. This documentation change does not independently
verify supplier sources, so it does not promote existing assumptions to supplier-confirmed rules.
When upstream behavior changes, record the source/date, revise a minimal anonymous contract fixture,
and update an independently worked example before changing the model.

## Rules and assumptions

| Topic                | Current behavior                                                                                                                                                                                               | Evidence class                                          | Local evidence                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Reference days       | Ordinary weekdays use ten eligible weekdays; weekends and bank holidays use four eligible weekend days. Exclude holidays and known event days. Select dates before inspecting readings.                        | Implemented model                                       | [Baseline tests](../src/domain/calculate.test.ts), `baseline date selection`                                   |
| History              | Search at most 60 days for references. Incomplete API event counts block baseline estimates; the oldest event date alone does not establish coverage.                                                          | App policy / API contract                               | [Calculation](../src/domain/calculate.ts), [API tests](../src/api/client.test.ts)                              |
| Intervals and time   | Complete, aligned half-hours; London wall time for matching references; reject ambiguous/nonexistent reference times. Zero is valid; invalid or duplicate intervals are unavailable.                           | App policy                                              | [Calculation tests](../src/domain/calculate.test.ts), [time tests](../src/domain/time.test.ts)                 |
| Net consumption      | Power down/up use import minus linked export. A missing linked export reading blocks the estimate; no linked export meter is distinct. Never combine serials.                                                  | Implemented model                                       | [Calculation tests](../src/domain/calculate.test.ts), [API tests](../src/api/client.test.ts)                   |
| Qualifying change    | For each half-hour, Power down counts positive baseline-minus-actual; Power up counts positive actual-minus-baseline. Sum qualifying changes, keeping whole-session net change separate.                       | Implemented model                                       | [Calculation tests](../src/domain/calculate.test.ts), `calculates turn up and clips each half-hour separately` |
| Happy Hours          | Sum imported usage without a baseline or exports. Do not clip the energy total to a reward cap. Cash credit is not independently priced.                                                                       | Implemented model / support limit                       | [Happy Hours tests](../src/domain/calculate.test.ts)                                                           |
| Power down points    | Multiply total qualifying kWh by the published event rate. Using eight points per penny, round upward to a whole penny once for the session; assume a 16-point minimum for a positive reward. Zero earns zero. | Inferred reward model; rounding and minimum unconfirmed | [Points](../src/domain/points.ts), [points tests](../src/domain/points.test.ts)                                |
| Power up rewards     | Show energy estimates, but withhold independent reward pricing because required tariff inputs are absent.                                                                                                      | Support limit                                           | [Points tests](../src/domain/points.test.ts), `does not invent Octopoints`                                     |
| Official results     | Keep unpublished results pending; a pending zero can be a placeholder. Compare supplied final values independently. Energy and points publication handling have distinct cases.                                | API interpretation                                      | [Session semantics](../src/domain/session.ts), [points tests](../src/domain/points.test.ts)                    |
| Comparison tolerance | An absolute 0.01 kWh threshold determines energy mismatch; baseline/actual comparisons can also reveal a mismatch. It is not a supplier settlement tolerance.                                                  | App policy                                              | [Calculation tests](../src/domain/calculate.test.ts), `zero is a published result, and tolerance is absolute`  |
| Missing-data age     | Completed reading gaps older than seven days are labeled presumed missing; late data can still replace them. Future intervals are excluded.                                                                    | App heuristic, not a delivery deadline                  | [Coverage](../src/domain/coverage.ts), [coverage tests](../src/domain/coverage.test.ts)                        |
| Supported windows    | Recognized session types from 29 Nov 2024, aligned positive windows of at most 24 elapsed hours within one London calendar date; custom ranges include at most 366 dates.                                      | App support limit                                       | [Calculation](../src/domain/calculate.ts), [date ranges](../src/domain/dateRange.ts)                           |
| Home Mini            | Fill only absent import intervals, matching MPAN and serial. Use completed, aligned telemetry within the conservative 29-day window and convert Wh to kWh. Preserve existing standard rows even if invalid.    | App fallback policy                                     | [Home Mini](../src/api/homeMini.ts), [Home Mini tests](../src/api/homeMini.test.ts)                            |
| Provisional results  | Mini inputs in either session usage or baseline make the estimate provisional and suppress missed-reward alerts. Standard data replaces fallback inputs on refresh.                                            | App policy                                              | [Calculation tests](../src/domain/calculate.test.ts), [outcome tests](../src/domain/outcome.test.ts)           |
| Dependency failure   | Holiday, linked-export, and event-history failures block dependent baseline calculations; import-only Happy Hours remain usable. Informational warnings never change eligibility.                              | App policy                                              | [Calculation tests](../src/domain/calculate.test.ts), `explains the unavailable` and `informational warnings`  |

## Independently worked examples

These inputs and expected outputs are small enough to inspect without running the implementation.
The named tests contain the regression scenarios; preserve their independent expectations when
migrating arithmetic to Decimal.

| Example               | Inputs and reasoning                                                                                                                                 | Expected result                                                                                                                                                        | Regression evidence                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Bank holiday baseline | Four selected weekend days provide 1, 2, 3, and 4 kWh for each matching half-hour. The mean is 2.5 kWh per slot. Two session slots each use 0.5 kWh. | Baseline 5 kWh; actual 1 kWh; Power down qualifying change 4 kWh. Removing one selected day's readings makes the baseline unavailable without changing selected dates. | [calculate.test.ts](../src/domain/calculate.test.ts): `calculates a bank holiday from four known weekend days, not weekday usage` |
| Power up clipping     | Baseline slots are 0.6 and 0.6 kWh; actual slots are 1.6 and 0.15 kWh. Qualifying increases are 1 and 0 kWh.                                         | Rewarded energy 1 kWh; baseline-minus-actual over the whole session is -0.55 kWh.                                                                                      | [calculate.test.ts](../src/domain/calculate.test.ts): `calculates turn up and clips each half-hour separately`                    |
| Points rounding       | 0.21 kWh at 80 points/kWh gives 16.8 raw points, or 2.1p. Round upward to 3p.                                                                        | 24 points under the inferred model.                                                                                                                                    | [points.test.ts](../src/domain/points.test.ts): `estimates %s kWh at %s points/kWh without rounding energy first`                 |
| Minimum reward        | 0.1471 kWh at 16 points/kWh gives 2.3536 raw points; penny rounding gives 8 points, below the assumed 16-point minimum.                              | 16 points under the inferred model.                                                                                                                                    | Same points table                                                                                                                 |
| Exact boundary        | 0.3 kWh at 80 points/kWh is exactly 24 points; 0.300001 kWh yields 24.00008 raw points.                                                              | Respectively 24 and 32 points after whole-penny rounding. Equal baseline and actual readings must earn zero, without a spurious minimum.                               | Points table and `does not award minimum points for floating-point noise in identical baseline and session readings`              |
| Import-only usage     | Happy Hour import slots are 10 and 10 kWh; linked export is 1 kWh per slot. A separately supplied reward-related energy figure is 16 kWh.            | Imported usage remains 20 kWh, with no export subtraction or reward-cap clipping.                                                                                      | [calculate.test.ts](../src/domain/calculate.test.ts): `does not clip imported usage to the reward cap or subtract export`         |

## Maintaining useful evidence

For API changes, keep a small set of representative, minimal, anonymous response fixtures with
the contract shape and expected validation behavior. Never preserve credentials, account IDs,
addresses, names, or meter identifiers from real accounts. Include malformed and optional-data
cases where they affect the contract; reject unexpected network access in tests.

For methodology changes, exercise the path from validated dataset inputs through calculation and
reward outputs. Derive expected values independently; do not call the calculator to generate its
own expected answers. Extend focused examples for the behavior changing rather than growing
combinatorial snapshots. Neither fixture agreement nor coverage thresholds prove supplier parity.

The Decimal migration is accepted but pending. Existing code still contains native floating-point
arithmetic and compensating epsilons. Preserve intended business outcomes with explicit Decimal
precision/rounding choices; distinguish numerical artifacts from intentional tolerances such as
0.01 kWh. Maintain assumptions and numerical policy in this document; use [ADR.md](ADR.md) only
for significant architectural choices.

## Visible-history totals

Totals sum each column independently over the visible session type and date range. Missing and
pending values are excluded, not replaced by zero; a column with no available values shows the
usual placeholder. Each total shows “2 of 3 results included” (for example), since calculated and Octopus
columns may cover different sessions. Provisional inputs mark the corresponding calculated totals.
Happy Hours sum import usage and cash credit; Power up has no estimated reward total.

The totals path uses `decimal.js-light` with a shared 40-significant-digit precision and half-up
rounding configuration. There is no division in this path. Values enter from the existing numeric
calculation boundary; they remain Decimal through summation, then energy is displayed to two
places. Rewards sum the already rounded per-session awards, without rounding or repricing the
aggregate. The legacy reading and reward calculators still use native arithmetic pending the
wider ADR-004 migration; this change does not migrate or certify those calculations.

The combined overview uses the same visible sessions as the history. Calculated achievement
counts reuse the row outcome codes, including partly achieved sessions; official achievement
counts use published SUCCESS and PARTIAL_SUCCESS statuses, with published FAIL counting as an
available non-achievement. Provisional estimates mark corresponding counts and totals.
Possible missed rewards reuse the row attention decision, so provisional estimates cannot raise
an alert. Pending, missing-reading and upcoming official statuses are counted separately.
Happy Hours show usage rather than achievement, and no independent cash-credit estimate.
