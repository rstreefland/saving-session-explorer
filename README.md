# Saving Session Explorer

Compare estimates from your smart meter readings with Octopus Energy’s Saving Session results. See how a session went before the official figures arrive, then inspect the calculation and look for possible missed rewards.

Not affiliated with or endorsed by Octopus Energy.

## Getting started

Install [Node.js 24 LTS](https://nodejs.org/) and npm 10 or later, then clone the repository:

```sh
git clone https://github.com/rstreefland/saving-session-explorer.git
cd saving-session-explorer
```

Install dependencies and start the development server:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. In the Account section, choose **Try demo** to explore sample results, or enter your Octopus API key and account number. A smart meter sharing half-hourly electricity readings is needed for independent estimates.

Last 30 days is selected by default, including joined sessions later today. Custom dates can include future days to inspect upcoming sessions. Switch between Power down, Power up and Happy Hours, or choose custom dates. On mobile, comparison cards show calculated and Octopus results side by side; larger screens use a table. Use the chevron on a session to inspect its readings, baseline and reward calculation.

## Development commands

| Command                      | Purpose                                                        |
| ---------------------------- | -------------------------------------------------------------- |
| `npm run dev`                | Start the local development server.                            |
| `npm test`                   | Run the unit and React Testing Library tests.                  |
| `npm run test:coverage`      | Run tests with coverage reporting.                             |
| `npm run format`             | Format the project with Prettier.                              |
| `npm run format:check`       | Check formatting without changing files.                       |
| `npm run test:browser:build` | Build and check mobile layouts and CSP in Chromium and WebKit. |
| `npm run build`              | Type-check and build the static site into `dist/`.             |

To run a single test file:

```sh
npm test -- src/domain/calculate.test.ts
```

For browser checks, install the test browsers once:

```sh
npx playwright install --with-deps chromium webkit
npm run test:browser:build
```

The browser suite checks the production build at widths from 320px to desktop, including connected account controls, table alignment, expanded readings, Happy Hours and the security policy. All account/API responses are synthetic and intercepted locally.

Keep fixtures anonymous and add regression tests alongside the code they cover. Do not commit API keys or real account responses.

## Project structure

- `src/api`: API transport, response validation and query client configuration.
- `src/domain`: baseline calculations, outcome and reward estimates, dates and reading coverage.
- `src/hooks`: account-scoped server state, cancellation and responsive layout state.
- `src/components`: account controls, session history and calculation details.

Built with React 19, TypeScript, Vite, TanStack React Query, [temporal-polyfill](https://www.npmjs.com/package/temporal-polyfill), Zod, Lucide React and locally bundled Fontsource fonts. Styling is custom CSS; requests use native `fetch`. Tests use Vitest, React Testing Library, user-event, jest-dom and jsdom, with Istanbul coverage. Playwright checks layouts and the production security policy in Chromium and WebKit.

### Maintaining the data flow

`App` owns the selected dates and session type, and filters and sorts the rows once. `SessionHistory` renders those rows in the supplied order. `useSessionData` owns requests, cancellation and the account-scoped React Query results cache. The optional `load` prop allows tests to substitute the API loader.

`loadDataset` validates external responses and builds a `Dataset`. Its `baselineIssues` contain explicit reasons why baseline estimates are unavailable; `warnings` are informational and never change calculation eligibility. `domain/availability.ts` maps those reasons to messages. Calendar completeness is checked against the API's event count, not the date of its oldest event: a period with no events is valid. If the API introduces a bounded history window, model that coverage explicitly before calculating older baselines.

`calculateAll` is pure: it selects reference dates, checks half-hour readings, computes totals and compares published results. Select reference dates before checking readings so gaps cannot silently change the baseline. A missing value is `null`; zero is valid consumption. Happy Hours need import readings only. `sessionOutcome` supplies semantic codes for UI decisions; labels are presentation text.

When changing account handling, test the normal `App` with intercepted `fetch` as well as the hook in isolation. Forgetting an account must always clear memory and cancel requests, even if browser storage cannot be cleared. Keep the storage error visible so the user knows whether saved details remain.

## Account data and privacy

The app runs in your browser. The API key and account number are saved in local storage; results and readings are cached in memory. **Forget account** clears saved credentials and the React Query results cache. Accounts with multiple candidate meters are checked again whenever a dataset is fetched, so newly available half-hourly data can change the selected meter. Requests go directly to Octopus’s APIs and GOV.UK. No analytics or application backend is used.

Authentication and REST requests use `api.oegb-kraken.energy`. Session results use the separate `api.backend.octopus.energy` GraphQL endpoint because the primary API does not expose `savingSessions`. The API key is sent directly to Octopus to obtain an access token for reading session results and account details. The app does not change your account or join sessions.

The app is hosted on GitHub Pages at `saving-session-explorer.streefland.co.uk`, with its own local-storage origin. Other subdomains cannot read that storage. If hosted at a GitHub Pages project URL instead, every app under the same `<owner>.github.io` hostname shares local storage, regardless of path. Only trusted apps should share a hostname with saved API keys.

The production build includes a Content Security Policy that restricts scripts to bundled files and network requests to the app, Octopus and GOV.UK. It is not a substitute for a dedicated origin. Development mode keeps Vite's live reload working without applying the production policy.

## Estimates and limitations

Power down and Power up estimates compare net import with a historical baseline, counting qualifying changes separately for each half-hour. Ordinary weekday sessions use ten eligible weekdays; weekend and bank holiday sessions use four eligible weekend days. Holidays and event days are excluded from the reference dates. Happy Hours use imported electricity without a baseline. Missing or invalid readings and incomplete history prevent a complete estimate. A failure to load linked export readings or verify bank holidays blocks baseline-based estimates but leaves import-only Happy Hour estimates available. Data may arrive late or be revised, and readings from different meter serials are not combined.

Power down Octopoints use the published event rate, with inferred whole-penny rounding and a 2p minimum for a positive reward. This formula has not been confirmed by Octopus. Power up reward estimates are not shown; energy shifts are still estimated. Happy Hour cash credits are not independently priced.

Estimates and discrepancies do not prove that a reward is incorrect. Sources: [Saving Sessions FAQs](https://octopus.energy/blog/saving-sessions-faqs/), [Octoplus terms](https://octopus.energy/Octoplus-terms-and-conditions/), [Octopus UK API documentation](https://developer.oegb-kraken.energy/) and [GOV.UK bank holidays](https://www.gov.uk/bank-holidays.json).

## Deployment

Pushing or merging to `main` automatically builds and deploys the site. Pull requests run formatting checks, coverage tests, a production build and Chromium/WebKit browser checks before merging.

To redeploy manually, choose **Actions → Deploy GitHub Pages → Run workflow** and select `main`.

The deployment workflow validates and builds the app, uploads `dist/` using `upload-pages-artifact`, then publishes it using `deploy-pages`. Only `main` can deploy.

The site uses `/` as its base path for `saving-session-explorer.streefland.co.uk`. The hostname is recorded in `public/CNAME` and configured in **Settings → Pages**, with DNS managed in Cloudflare. See [GitHub's custom-domain setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) when configuring a different host.

## About this experiment

This project was entirely built using AI, guided by human prompts and feedback. It is experimental software, not a reproduction of Octopus’s settlement system.

### Upcoming sessions

Joined Power down and Power up sessions are shown before they end. Expand a session to inspect its historical baseline while session usage and calculated results await readings. Future sessions are available through Custom dates. A baseline requires all eligible reference readings; for sessions farther ahead, some reference days may not have happened yet. Refresh results to load newly available readings and results.

### Provisional Home Mini fallback

When standard import readings are absent, the app queries `smartMeterTelemetry`
with `HALF_HOURLY` grouping using the existing account access token. It matches the
active device to both the selected MPAN and meter serial, requests UTC days within
the last 29 days (inside the API's rolling 30-day history limit), and converts
`consumptionDelta` from Wh to kWh. Only completed, aligned half-hours with a finite,
nonnegative value are accepted. Nulls and duplicate telemetry remain missing;
existing standard rows, including invalid or conflicting rows, are never overwritten.

Sessions using Mini inputs for usage or baseline show a small clock indicator with a tooltip explaining
that the readings are provisional. Refreshing reloads standard readings first, replacing fallback data as they
arrive. Provisional estimates do not trigger possible-missed-reward alerts. Export
readings still come exclusively from the standard API. Older gaps and gaps in the
Mini stream remain missing. Daily requests run sequentially, stop on an API error,
and preserve successful data; fallback failures never prevent standard results
from loading. No background collection or persistent telemetry cache is added.

### Search and link previews

The initial HTML includes the public introduction without requiring JavaScript.
It is rendered from the same component as the interactive introduction and never
includes account data. The page supplies a meta description, canonical URL,
Open Graph and Twitter metadata, an SVG favicon, and a 1200×630 PNG sharing card.
The editable sharing-card source is `public/social-card.svg`.

`public/robots.txt` allows crawling and points to `public/sitemap.xml`, which lists
the single public page. If the public hostname changes, update the canonical,
sharing URLs, robots sitemap URL, sitemap entry and `public/CNAME` together.
