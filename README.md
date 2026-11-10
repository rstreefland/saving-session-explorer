# Saving Session Explorer

Compare estimates from your smart meter readings with Octopus Energy's results for Power down,
Power up, and Happy Hours.

I built this project entirely using AI to explore the limits of frontier models and how we can work with them more effectively.

It's not affiliated with or endorsed by Octopus Energy.

[Open the app](https://saving-session-explorer.streefland.co.uk) and choose **Try demo**, or connect
with your Octopus API key and account number. You'll need a smart meter sharing half-hourly
electricity readings for independent estimates. Your credentials are saved in your browser;
**Forget account** removes them.

## Run locally

Use Node.js 24 and npm 10 or later:

```sh
git clone https://github.com/rstreefland/saving-session-explorer.git
cd saving-session-explorer
npm ci
npm run dev
```

Open the local URL printed in the terminal.

[Documentation](docs/)
