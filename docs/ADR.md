# Architecture decisions

These decisions record choices that would materially change the app if reversed. Coding rules
are in [AGENTS.md](../AGENTS.md); calculation assumptions are in [methodology.md](methodology.md).

## ADR-010: Keep account access in the browser

2026-11-08. Accepted.

The app runs entirely in the browser and reads Octopus accounts without changing them. There's no
application backend, so we don't need to operate a service that holds account data. Credentials
stay in browser storage; readings and results stay in memory. Background collection or server-side
processing would require revisiting this decision.

## ADR-002: Use Temporal for dates and times

2026-11-08. Accepted; migration pending.

Temporal is the sole date/time model because calendar dates and elapsed intervals behave
differently across UK clock changes. Using one model avoids mixing host-timezone assumptions
and incompatible representations. Existing JavaScript `Date` usage still needs to migrate.

## ADR-004: Use decimal.js-light for numeric arithmetic

2026-11-08. Accepted; implemented.

The app uses decimal.js-light throughout because binary floating-point artefacts can change
energy and reward results. Values stay as Decimal through calculations, with explicit rounding
at display and reward boundaries. The precision limits and rounding rules are in
[methodology.md](methodology.md).
