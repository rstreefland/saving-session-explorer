# Saving Session Explorer

Compare estimates from your smart meter readings with Octopus Energy's results for Power down,
Power up, and Happy Hours.

[Open the app](https://saving-session-explorer.streefland.co.uk) and choose **Try demo**, or connect
with your Octopus API key and account number. Independent estimates require a smart meter sharing
half-hourly electricity readings. Credentials are saved in your browser; **Forget account** removes them.

## Run locally

Use Node.js 24 and npm 10 or later:

```sh
git clone https://github.com/rstreefland/saving-session-explorer.git
cd saving-session-explorer
npm ci
npm run dev
```

Open the local URL printed in the terminal.

[Calculation methodology](docs/methodology.md) · [Contributor guide](AGENTS.md)
