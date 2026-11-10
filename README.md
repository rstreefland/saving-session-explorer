# Saving Session Explorer

Compare estimates from your smart meter readings with Octopus Energy's results for Power down,
Power up, and Happy Hours.

I built this project entirely using AI to explore the limits of frontier models and how we can work with them more effectively.

It's not affiliated with or endorsed by Octopus Energy. Differences between estimates and
published results don't prove underpayment; the calculation assumptions and limits are in
[the methodology](docs/methodology.md).

Open https://saving-session-explorer.streefland.co.uk and choose **Try demo**, or connect with your
Octopus API key and account number. Independent estimates need a smart meter sharing half-hourly
electricity readings. The app runs in your browser: credentials are saved there, while readings
and results stay in memory. **Forget account** removes your saved credentials.

To run locally, use Node.js 24 and npm 10 or later:

```sh
git clone https://github.com/rstreefland/saving-session-explorer.git
cd saving-session-explorer
npm ci
npm run dev
```

Open the local URL printed in the terminal. For development, read the
[working agreement](AGENTS.md) and [architecture decisions](docs/ADR.md).
