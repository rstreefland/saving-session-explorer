# Saving Session Explorer

Compare smart meter estimates with Octopus Energy's results for Power down, Power up, and Happy
Hours.

I built this project entirely using AI to explore the limits of frontier models and how we can work
with them more effectively.

> Not affiliated with or endorsed by Octopus Energy. Differences between estimates and published
> results do not prove underpayment; see [the methodology](docs/methodology.md).

## Use it

Open [saving-session-explorer.streefland.co.uk](https://saving-session-explorer.streefland.co.uk)
and choose **Try demo**, or connect with your Octopus API key and account number.

- **Requires:** a smart meter sharing half-hourly electricity readings.
- **Privacy:** runs entirely in your browser. Credentials stay in browser storage (**Forget
  account** removes them); readings and results stay in memory.

## Run locally

Requires Node.js 24 and npm 10+.

```sh
git clone https://github.com/rstreefland/saving-session-explorer.git
cd saving-session-explorer
npm ci
npm run dev
```

## Docs

- [Methodology](docs/methodology.md)
- [External APIs and data loading](docs/api.md)
- [Architecture decisions](docs/ADR.md)
- [Working agreement](AGENTS.md)

## Licence

[MIT](LICENSE)
