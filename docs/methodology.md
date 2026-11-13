# Calculation methodology and evidence

The app estimates usage and rewards from meter readings and published event rates, then compares
those estimates with Octopus's results. It doesn't use official results to fill gaps in its own
calculations. A difference doesn't prove underpayment, because this model doesn't reproduce or
certify Octopus's settlement process.

## What the evidence means

The rules below describe the implementation. None is promoted to supplier-confirmed solely
because the app has a passing test.

- **Supplier-confirmed** needs an exact supplier source, a verification date, and the session or
  rule period it applies to.
- **Implemented model** means the repository implements the rule and has regression evidence.
- **Inferred** means an empirical assumption still needs supplier confirmation.
- **App policy** means a safety, display, or support choice made by this app.

## Which sessions the app supports

The app supports recognised session types from 29 Nov 2024. A session must start and end on
aligned half-hour boundaries, have positive duration, last no more than 24 elapsed hours, and
fit within one London calendar date. Custom date ranges can include up to 366 dates. These are
app support limits, recorded in [calculate.ts](../src/domain/calculate.ts) and
[dateRange.ts](../src/domain/dateRange.ts).

## How Power down and Power up estimates work

First, the app chooses the dates used to estimate normal usage, called the baseline. Ordinary
weekdays use ten eligible weekdays. Weekends and bank holidays use four eligible weekend days.
Holidays and known event days are excluded. The app chooses these dates before looking for
readings, so missing readings can't cause it to substitute older dates. This is the implemented
model, covered by `baseline date selection` in [calculate.test.ts](../src/domain/calculate.test.ts).

The search stops after 60 days. The app also checks API event counts, because an incomplete
calendar could cause it to use an event day as a reference. Incomplete counts block baseline
estimates; the oldest event date alone doesn't establish coverage. These are app policy and API
contract checks in [calculate.ts](../src/domain/calculate.ts) and
[client.test.ts](../src/api/client.test.ts).

Next, the app matches each session half-hour to the same London wall time on the selected dates.
Readings must cover complete, aligned half-hours. Zero is valid, but invalid or duplicate
intervals are unavailable. Ambiguous or nonexistent reference times are rejected rather than
guessed. These are app policies covered by [calculate.test.ts](../src/domain/calculate.test.ts)
and [time.test.ts](../src/domain/time.test.ts).

Both Power down and Power up use import minus linked export. A missing reading from a linked
export meter blocks the estimate; having no linked export meter is a different case. Readings
from different meter serials are never combined. This implemented model is covered by
[calculate.test.ts](../src/domain/calculate.test.ts) and [client.test.ts](../src/api/client.test.ts).

The app then calculates the qualifying change separately for each half-hour:

- Power down counts baseline minus actual usage when the result is positive.
- Power up counts actual usage minus baseline when the result is positive.

It adds those qualifying changes for the reward estimate. It keeps the whole-session net change
separate, because a change in the wrong direction in one half-hour doesn't cancel a qualifying
change in another. See `calculates turn up and clips each half-hour separately` in
[calculate.test.ts](../src/domain/calculate.test.ts).

For example, a bank holiday's four reference days supply 1, 2, 3, and 4 kWh for each matching
half-hour. Their mean is 2.5 kWh per half-hour. If a two-slot Power down session uses 0.5 kWh in
each slot, its baseline is 5 kWh, actual usage is 1 kWh, and qualifying reduction is 4 kWh.
Removing a selected day's readings makes the baseline unavailable without changing the selected
dates. See `calculates a bank holiday from four known weekend days, not weekday usage` in
[calculate.test.ts](../src/domain/calculate.test.ts).

For Power up, baseline slots of 0.6 and 0.6 kWh and actual slots of 1.6 and 0.15 kWh give qualifying
increases of 1 and 0 kWh. Rewarded energy is therefore 1 kWh, while baseline minus actual over
the whole session is -0.55 kWh. The clipping test above covers this independently worked example.

## How Happy Hours differ

Happy Hours add imported usage without a baseline or export subtraction. The app doesn't cap
that energy total using a reward-related figure, and it doesn't independently price the cash
credit. This is the implemented model and a reward-pricing support limit.

For example, import slots of 10 and 10 kWh still give 20 kWh of usage when export is 1 kWh per
slot and a separately supplied reward-related figure is 16 kWh. See `does not clip imported
usage to the reward cap or subtract export` in [calculate.test.ts](../src/domain/calculate.test.ts).

## How rewards are estimated

Power down multiplies total qualifying kWh by the published event rate. Under the inferred reward
model, eight points equal one penny. The app rounds upward to a whole penny once for the session,
then applies an assumed 16-point minimum to a positive reward. Zero earns zero. The rounding and
minimum still need supplier confirmation. See [points.ts](../src/domain/points.ts) and
[points.test.ts](../src/domain/points.test.ts).

These examples calculate the expected results independently:

- 0.21 kWh at 80 points/kWh gives 16.8 points, or 2.1p. Rounding upward to 3p gives 24 points.
- 0.1471 kWh at 16 points/kWh gives 2.3536 points. Penny rounding gives eight points, so the
  assumed minimum raises the reward to 16 points.
- 0.3 kWh at 80 points/kWh gives exactly 24 points. At 0.300001 kWh, the raw result is 24.00008
  points, which rounds upward to 32 points.
- Equal baseline and actual readings earn zero, without triggering the minimum.

The points table test `estimates %s kWh at %s points/kWh without rounding energy first` and
`does not award minimum points for floating-point noise in identical baseline and session
readings` cover these cases in [points.test.ts](../src/domain/points.test.ts).

Power up shows energy estimates but doesn't independently price rewards because the required
tariff inputs are absent. This support limit is covered by `does not invent Octopoints` in
[points.test.ts](../src/domain/points.test.ts).

## What missing and provisional data mean

Completed reading gaps older than seven days are labelled presumed missing. That's an app
heuristic, not a supplier delivery deadline: late readings can still replace them. Future
intervals are excluded. See [coverage.ts](../src/domain/coverage.ts) and
[coverage.test.ts](../src/domain/coverage.test.ts).

Home Mini can fill absent import intervals using completed, aligned telemetry within a
conservative 29-day window. It must match both MPAN and serial and converts Wh to kWh. It never
replaces an existing standard row, even if that row is invalid. This fallback policy is covered
by [homeMini.ts](../src/api/homeMini.ts) and [homeMini.test.ts](../src/api/homeMini.test.ts).

Mini data in either session usage or the baseline makes the estimate provisional. The app
suppresses missed-reward alerts for provisional estimates; standard data replaces fallback
inputs on refresh. See [calculate.test.ts](../src/domain/calculate.test.ts) and
[outcome.test.ts](../src/domain/outcome.test.ts).

Holiday, linked-export, and event-history failures block the baseline calculations that depend
on them. Import-only Happy Hours remain usable. Informational warnings never change eligibility.
These app policies are covered by `explains the unavailable` and `informational warnings` in
[calculate.test.ts](../src/domain/calculate.test.ts).

## How official results are compared

Unpublished results stay pending, because a pending zero can be a placeholder. The app compares
supplied final values independently and handles energy and points publication separately.
This is an API interpretation, covered by [session.ts](../src/domain/session.ts) and
[points.test.ts](../src/domain/points.test.ts).

An absolute difference greater than 0.01 kWh counts as an energy mismatch; exactly 0.01 kWh is a
match. Differences in baseline or actual usage can also reveal a mismatch. This threshold is an
app policy, not a supplier settlement tolerance. See `zero is a published result, and tolerance
is absolute` in [calculate.test.ts](../src/domain/calculate.test.ts).

## Precision and rounding

The app uses one configured `decimal.js-light` constructor for numeric arithmetic, as recorded
in [ADR-003](ADR.md) and [decimal.ts](../src/domain/decimal.ts). It keeps Decimal values through
calculations and comparisons so binary floating-point artefacts don't affect energy or rewards.

Arithmetic uses 40 significant digits. The library truncates at that precision, including for
non-terminating division: 1/3 becomes 40 threes after the decimal point. Reference means divide
by four or ten, Mini conversion by 1,000, and points conversion by eight. Those divisions
terminate exactly when the result fits 40 significant digits. Larger inputs can still lose
low-order digits. This is a numerical policy, not a supplier rule.

Zod validates finite numbers and decimal strings at API boundaries and preserves supplied
strings. The browser has already parsed JSON numeric tokens, so the app can't recover precision
lost there. Numeric strings outside the finite Number range or Decimal exponent range are
rejected. Mini conversion stores exact kWh as a decimal string.

Datasets remain plain serialisable inputs for the in-memory cache and demo cloning. Calculated
energy, references, and rewards stay as Decimal values through comparison and rendering.
Counts, indexes, and DOM geometry convert at presentation or library boundaries.

Display rounding is half-up: summaries use two decimal places, readings use three, and points
breakdowns use up to six. Grouping uses `en-GB` without converting decimal amounts to binary
numbers. Reward rounding follows the separate whole-penny rule above. Raw rewards must be at
most `Number.MAX_SAFE_INTEGER - 8` points.

An achievement label requires energy strictly greater than 0.000000001 kWh. Change colours are
neutral when the absolute change is strictly below 0.000000001 kWh. These are separate
presentation policies, so a tiny positive reward can receive the minimum even when it's below
the achievement-label threshold.

Decimal arithmetic removed the earlier binary epsilon guards around zero energy, whole-penny
boundaries, and the 0.01 kWh comparison. These corrections are intentional; date selection,
missing-data rules, publication, provenance, reward rules, and interaction are unchanged:

- Five 0.100 and five 0.101 kWh readings total 1.005 kWh. Dividing by ten now gives exactly
  0.1005, displayed as 0.101, matching ten uniform 0.1005 readings. The previous result was
  0.10049999999999999, displayed as 0.100.
- Displaying 1.005 to two decimals gives 1.01 under half-up rounding. Native `toFixed` gave 1.00.
- 0.3000000000000001 kWh at 80 points/kWh gives 24.000000000000008 raw points and rounds upward
  to 32 points. The old penny epsilon guard snapped it to 24 points.
- 0.0000000000000001 kWh at 80 points/kWh gives 0.000000000000008 raw points. Penny rounding
  gives eight points, then the minimum gives 16. The old guard snapped the energy and points to zero.
- An absolute difference of 0.0100000001 kWh is a mismatch. The old extra 0.000000001 guard
  treated it as a match; exactly 0.01 kWh remains a match.
- A UTC interval from 00:00:00.000000001 to 00:30:00.000000001 is rejected as misaligned using
  full Temporal precision. Truncating timestamps to milliseconds previously accepted it.
- 100.00000000000001 Wh divided by 1,000 gives exactly 0.10000000000000001 kWh. Number conversion
  previously gave 0.10000000000000002 kWh.

[decimal.test.ts](../src/domain/decimal.test.ts),
[numericSchema.test.ts](../src/api/numericSchema.test.ts),
[client.test.ts](../src/api/client.test.ts), and the
[production browser tests](../tests/browser/decimal.spec.ts) cover these boundaries alongside the
worked session examples. Invalid or non-finite energy can't become a calculated Decimal value;
boundary validation tests cover those inputs instead.

## Updating the evidence

When upstream behaviour changes, record the source and verification date, update a minimal
anonymous contract fixture, and revise an independently worked example before changing the
model. Tests alone don't establish supplier confirmation.

API fixtures should preserve the response shape and expected validation behaviour, including
malformed or optional data where it affects the contract. Don't retain real credentials, account
IDs, addresses, names, or meter identifiers. Reject unexpected network access in tests.

For methodology changes, test the path from validated dataset inputs through calculation and
reward outputs. Calculate expectations independently rather than using the calculator to produce
its own answers. Extend focused examples for the changed behaviour instead of adding combinatorial
snapshots. Fixture agreement and coverage thresholds don't prove agreement with Octopus.

## Visible-history totals

Totals sum each column independently over the visible session type and date range. Unavailable
values and pending results are excluded, not replaced by zero; a column with no available values shows the
usual placeholder. Each total shows “2 of 3 results included” (for example), since calculated and Octopus
columns may cover different sessions. Provisional inputs mark the corresponding calculated totals.
Happy Hours sum import usage and cash credit; Power up has no estimated reward total.

Totals use the shared Decimal precision and rounding policy above. Energy is displayed to two
places. Rewards sum already-rounded per-session awards, without repricing the aggregate.
A supplied Octopus average credit for a missing-reading session can contribute to the reward
total even though its energy and achievement remain unavailable.

The combined overview uses the same visible sessions as the history. Calculated achievement
counts reuse the row outcome codes, including partly achieved sessions; official achievement
counts use published SUCCESS and PARTIAL_SUCCESS statuses, with published FAIL counting as an
available non-achievement. Provisional estimates mark corresponding counts and totals.
Possible missed rewards reuse the row attention decision, so provisional estimates cannot raise
an alert. Pending, missing-reading and upcoming official statuses are counted separately.
Happy Hours show usage rather than achievement, and no independent cash-credit estimate.
