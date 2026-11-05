# Saving Session Explorer

Compare estimates from your smart meter readings with Octopus Energy’s Saving Session results. Inspect the numbers and look for possible missed rewards.

## Getting started

The application is being reviewed in [PR #1](https://github.com/rstreefland/saving-session-explorer/pull/1). The `main` branch currently contains only this README. To try the implementation, install [Node.js 24 LTS](https://nodejs.org/) and npm 10 or later, then run:

```sh
git clone --branch experiment/saving-session-explorer https://github.com/rstreefland/saving-session-explorer.git
cd saving-session-explorer
npm ci
npm run dev
```

Open the local URL printed by Vite. Choose **Try demo** in the Account section to explore sample results, or enter your Octopus API key and account number. Independent estimates require a smart meter sharing half-hourly electricity readings.

## Development

```sh
npm test
npm run test:coverage
npm run format:check
npm run build
```

The implementation branch’s README explains the project structure, API connections and calculation limits. No site has been deployed yet.

## About this experiment

This project was entirely built using AI, guided by human prompts and feedback. Not affiliated with or endorsed by Octopus Energy.
