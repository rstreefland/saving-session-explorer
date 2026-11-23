# External APIs and data loading

All network requests run directly from the browser and are restricted by the production CSP
`connect-src` in [vite.config.ts](../vite.config.ts) to three origins:

- `https://api.oegb-kraken.energy`
- `https://api.backend.octopus.energy`
- `https://www.gov.uk`

## Endpoints and authentication

| Endpoint                                                                          | Auth                                     | Purpose                                                               | Required?             |
| --------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------- | --------------------- |
| `POST https://api.oegb-kraken.energy/v1/graphql/`                                 | API key (`obtainKrakenToken`)            | Exchange API key for a Kraken JWT                                     | Required              |
| `POST https://api.backend.octopus.energy/v1/graphql/`                             | Kraken token                             | Saving Sessions calendar, `eventCount`, signed-up MPAN, joined events | Required              |
| `GET https://api.oegb-kraken.energy/v1/accounts/{account}/`                       | Basic (`API key:`)                       | Properties, electricity meter points, and meter serials               | Required              |
| `GET https://api.oegb-kraken.energy/v1/electricity-meter-points/.../consumption/` | Basic (`API key:`)                       | Half-hourly import (and optional linked export) kWh readings          | Import yes; export no |
| `GET https://www.gov.uk/bank-holidays.json`                                       | None                                     | UK bank holiday dates by region                                       | Optional (baselines)  |
| `POST https://api.oegb-kraken.energy/v1/graphql/`                                 | Kraken token                             | Account number and billing name (`fetchAccountProfile`)               | Optional              |
| `POST https://api.oegb-kraken.energy/v1/graphql/`                                 | Kraken token                             | Home Mini `deviceId` lookup and daily half-hourly Wh telemetry        | Optional              |
| `POST https://api.backend.octopus.energy/v1/graphql/`                             | Kraken token (`obtainKrakenToken` first) | Account-wide Happy Hours `tokenBalance`                               | Optional              |

## Request safety, pagination, and cancellation

Defined in [transport.ts](../src/api/transport.ts) and [client.ts](../src/api/client.ts):

- **Encoding and pagination:** Path segments (`account`, `mpan`, `serial`) are URI-encoded.
  Authenticated pagination verifies every `next` link stays under
  `https://api.oegb-kraken.energy/v1/`, rejects repeated URLs, and stops at 100 pages (10 pages
  during meter discovery).
- **Reading window:** Standard readings are fetched with `page_size=25000` and `order_by=period`,
  starting 60 days before `from` (to cover baseline lookups) through the end of `to`.
- **Sanitised errors:** Upstream HTTP bodies and GraphQL `errors` arrays are never echoed to the UI
  or logs so credentials and personal data cannot leak. HTTP `401`/`403`, `429`, and network/CORS
  failures map to fixed user-facing messages.
- **Cancellation:** `AbortSignal` flows through every request and optional dependency. Aborted
  requests are always rethrown rather than converted into warnings or partial results.

## Meter discovery and selection

Defined in `selectMeter` and `loadDataset` in [client.ts](../src/api/client.ts):

- Locates the property containing the signed-up import MPAN (`!is_export`) and checks for export
  meter points (`is_export`) on that same property.
- When a meter point lists multiple serials, unique serials are sorted lexicographically and probed
  in parallel (`page_size=100`, `order_by=-period`, up to 10 pages each) for valid, aligned,
  non-negative half-hour readings.
- Picks the serial with the latest valid `interval_end`; sorting first makes ties deterministic
  regardless of API ordering. An HTTP `404` on an inactive serial is skipped, while other errors
  fail discovery rather than treating the meter as absent.
- Readings from different serials are never combined, and candidate serials are re-evaluated on
  refresh.
- **Linked export:** zero export meter points means no export meter (`exports: null`); one export
  meter point runs `selectMeter` and `fetchReadings`; multiple export meter points fail as
  ambiguous (blocking baselines without failing Happy Hours).

## Home Mini fallback

Defined in [homeMini.ts](../src/api/homeMini.ts):

- Runs only when standard import readings have missing half-hours inside a rolling **29-day
  (696-hour)** window up to the latest completed half-hour.
- Resolves `deviceId` strictly by matching both `mpan` and selected import `serial`, proceeding
  only when exactly one unique device ID matches.
- Fetches missing UTC days sequentially (newest first). On error or rate limit, it stops and keeps
  any days already fetched, recording a non-blocking warning. Standard rows are never overwritten.

## Happy Hours token balance

Defined in [happyHourTokens.ts](../src/api/happyHourTokens.ts) and
[useSessionData.ts](../src/hooks/useSessionData.ts):

- Loaded in a separate account-scoped query (`['happy-hour-tokens', scope]`), independent of the
  selected date range.
- Refetched on manual refresh; errors leave the badge unavailable (showing the usual placeholder)
  without blocking session data.

## Failure modes

| Dependency failure                                            | Effect                                                                                   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Auth, Saving Sessions query, account lookup, import meter     | Fails the load and shows an error.                                                       |
| GOV.UK holidays, linked export meter, incomplete `eventCount` | Recorded in `baselineIssues`; blocks Power down/up estimates, leaves Happy Hours usable. |
| Account profile, Home Mini telemetry, Happy Hours tokens      | Degrades gracefully (optional warning or placeholder); does not block any estimate.      |
