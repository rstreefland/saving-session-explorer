# Architecture decisions

Record only significant architectural choices whose reversal would materially change the app.
Coding standards belong in [AGENTS.md](../AGENTS.md); calculation assumptions belong in
[methodology.md](methodology.md).

| ID      | Date       | Status                      | Decision                                                                                           | Rationale and consequences                                                                                                                                                                                                |
| ------- | ---------- | --------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-010 | 2026-11-08 | Accepted                    | Run entirely in the browser, with read-only access to Octopus accounts and no application backend. | Avoid operating a service that holds account data. Credentials stay in browser storage; readings and results stay in memory. Background collection and server-side processing would require revisiting this architecture. |
| ADR-002 | 2026-11-08 | Accepted; migration pending | Use Temporal as the sole date/time model.                                                          | Calendar dates and elapsed intervals have different semantics across UK clock changes. One explicit model avoids mixing host-timezone assumptions and incompatible representations. Existing Date usage must migrate.     |
| ADR-004 | 2026-11-08 | Accepted; implemented       | Use decimal.js-light for numeric arithmetic throughout the app.                                    | Avoid binary floating-point artifacts in energy and rewards. Retain Decimal through calculations, with explicit rounding at display and reward boundaries; numerical policy is recorded in the methodology.               |
