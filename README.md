# Saving Session Explorer

Compare estimates from your smart meter readings with Octopus Energy’s Saving Session results. See how a session went before the official figures arrive, then inspect the calculation and look for possible missed rewards.

Not affiliated with or endorsed by Octopus Energy.

## Getting started

Install [Node.js 24 LTS](https://nodejs.org/) and npm 10 or later, then clone the repository:

```sh
git clone https://github.com/rstreefland/saving-session-explorer.git
cd saving-session-explorer
```

While [PR #1](https://github.com/rstreefland/saving-session-explorer/pull/1) is open, switch to its implementation branch before installing:

```sh
git switch experiment/saving-session-explorer
```

Install dependencies and start the development server:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. In the Account section, choose **Try demo** to explore sample results, or enter your Octopus API key and account number. A smart meter sharing half-hourly electricity readings is needed for independent estimates.

Last 30 days is selected by default. Switch between Power down, Power up and Happy Hours, or choose custom dates. Use the chevron on a session row to inspect its readings, baseline and reward calculation.

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

Built with React 19, TypeScript, Vite, TanStack React Query, the Temporal polyfill, Zod, Lucide React and locally bundled Fontsource fonts. Styling is custom CSS; requests use native `fetch`. Tests use Vitest, React Testing Library, user-event, jest-dom and jsdom, with Istanbul coverage. Playwright checks layouts and the production security policy in Chromium and WebKit.

### Maintaining the data flow

`App` owns the selected dates and session type, and filters and sorts the rows once. `SessionHistory` renders those rows in the supplied order. `useSessionData` owns requests, cancellation and the account-scoped loader; leave the optional `load` prop unset in production so the meter-discovery cache is used.

`loadDataset` validates external responses and builds a `Dataset`. Its `baselineIssues` contain explicit reasons why baseline estimates are unavailable; `warnings` are informational and never change calculation eligibility. `domain/availability.ts` maps those reasons to messages. Calendar completeness is checked against the API's event count, not the date of its oldest event: a period with no events is valid. If the API introduces a bounded history window, model that coverage explicitly before calculating older baselines.

`calculateAll` is pure: it selects reference dates, checks half-hour readings, computes totals and compares published results. Select reference dates before checking readings so gaps cannot silently change the baseline. A missing value is `null`; zero is valid consumption. Happy Hours need import readings only. `sessionOutcome` supplies semantic codes for UI decisions; labels are presentation text.

When changing account handling, test the normal `App` with intercepted `fetch` as well as the hook in isolation. Forgetting an account must always clear memory and cancel requests, even if browser storage cannot be cleared. Keep the storage error visible so the user knows whether saved details remain.

## Account data and privacy

The app runs in your browser. The API key and account number are saved in local storage; results and readings are cached in memory. **Forget account** clears saved credentials and the query and meter-discovery caches. Meter discovery is cached in memory for up to five minutes within the active account; account or API key changes discard it. Requests go directly to Octopus’s APIs and GOV.UK. No analytics or application backend is used.

Authentication and REST requests use `api.oegb-kraken.energy`. Session results use the separate `api.backend.octopus.energy` GraphQL endpoint because the primary API does not expose `savingSessions`. The authentication token exchange is the only GraphQL mutation; the app does not change your account.

Production hosting is prepared for `saving-session-explorer.streefland.co.uk`, giving this app its own local-storage origin. Other subdomains cannot read that storage. If hosted at a GitHub Pages project URL instead, every app under the same `<owner>.github.io` hostname shares local storage, regardless of path. Only trusted apps should share a hostname with saved API keys.

The production build includes a Content Security Policy that restricts scripts to bundled files and network requests to the app, Octopus and GOV.UK. It is not a substitute for a dedicated origin. Development mode keeps Vite's live reload working without applying the production policy.

## Estimates and limitations

Power down and Power up estimates compare net import with a historical baseline, counting qualifying changes separately for each half-hour. Ordinary weekday sessions use ten eligible weekdays; weekend and bank holiday sessions use four eligible weekend days. Holidays and event days are excluded from the reference dates. Happy Hours use imported electricity without a baseline. Missing or invalid readings and incomplete history prevent a complete estimate. A failure to load linked export readings or verify bank holidays blocks baseline-based estimates but leaves import-only Happy Hour estimates available. Data may arrive late or be revised, and readings from different meter serials are not combined.

Power down Octopoints use the published event rate, with inferred whole-penny rounding and a 2p minimum for a positive reward. This formula has not been confirmed by Octopus. Power up points and Happy Hour cash credits depend on tariff information and are not independently priced.

Estimates and discrepancies do not prove that a reward is incorrect. Sources: [Saving Sessions FAQs](https://octopus.energy/blog/saving-sessions-faqs/), [Octoplus terms](https://octopus.energy/Octoplus-terms-and-conditions/), [Octopus UK API documentation](https://developer.oegb-kraken.energy/) and [GOV.UK bank holidays](https://www.gov.uk/bank-holidays.json).

## Deployment

Pull requests run formatting checks, coverage tests, a production build and Chromium/WebKit browser checks. The Pages workflow uploads `dist/` using `upload-pages-artifact`, then deploys that artifact using `deploy-pages`.

Deployment is manual: pushing or merging does not publish the site. After owner approval, merge the implementation and configure **Settings → Pages** to use **GitHub Actions**, with the custom domain `saving-session-explorer.streefland.co.uk`. The site is built at `/` for this domain; `public/CNAME` records the intended hostname. For Actions-based Pages, the domain must also be set in repository settings.

Add the DNS record after configuring the domain in GitHub:

| Type  | Name                      | Target                  |
| ----- | ------------------------- | ----------------------- |
| CNAME | `saving-session-explorer` | `rstreefland.github.io` |

Once GitHub verifies DNS and provisions the certificate, enable **Enforce HTTPS**. Run **Deploy GitHub Pages** manually from the Actions tab on `main`. The workflow rejects other branches. See [GitHub's custom-domain setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

## About this experiment

This project was entirely built using AI, guided by human prompts and feedback. It is experimental software, not a reproduction of Octopus’s settlement system.
