import { MISSING_SESSION_EXPLANATION } from '../domain/session';

export function Methodology() {
  return (
    <section className="methodology panel" aria-label="Calculation guides">
      <details id="methodology">
        <summary>How your usage is calculated</summary>
        <ul>
          <li>
            <strong>Power down:</strong> rewards reductions below your usual usage.
          </li>
          <li>
            <strong>Power up:</strong> rewards increases above your usual usage.
          </li>
          <li>
            <strong>Happy Hours:</strong> adds up electricity imported during your booked hour,
            without a baseline.
          </li>
        </ul>
        <p>
          Power down and Power up use imports minus exports. Each half-hour counts separately, so a
          qualifying change in one half-hour isn’t cancelled out by another.
        </p>
      </details>
      <details>
        <summary>How your baseline is calculated</summary>
        <p>Your baseline estimates what you would normally use at the same time:</p>
        <ul>
          <li>
            <strong>Weekday sessions:</strong> average of the last 10 eligible weekdays.
          </li>
          <li>
            <strong>Weekend and bank holiday sessions:</strong> average of the last 4 eligible
            weekend days.
          </li>
        </ul>
        <p>
          The app looks back up to 60 days, excluding bank holidays and known session days. Missing
          readings can prevent a complete estimate.
        </p>
      </details>
      <details>
        <summary>Understanding your results and rewards</summary>
        <p>
          <strong>Calculated</strong> figures are this app’s estimates. <strong>Actual</strong>{' '}
          figures come from Octopus.
        </p>
        <p>For Power down and Power up, Octopus uses these result labels:</p>
        <ul>
          <li>
            <strong>Achieved:</strong> You opted in and shifted power over the whole Session
          </li>
          <li>
            <strong>Partly achieved:</strong> You opted in and shifted power for part of the Session
            (one half-hour slot out of two)
          </li>
          <li>
            <strong>Not achieved:</strong> You opted in but didn’t shift power at any point in the
            Session
          </li>
          <li>
            <strong>Missing data:</strong> {MISSING_SESSION_EXPLANATION}
          </li>
        </ul>
        <p>
          For Power down, the estimated reward uses the session’s Octopoints rate, rounds up to a
          whole penny and assumes a 2p minimum for a positive reward. These rounding assumptions fit
          the results checked but aren’t confirmed by Octopus.
        </p>
        <p>
          Power up energy use is estimated, but rewards aren’t estimated. Happy Hours pay bill
          credit rather than Octopoints.
        </p>
      </details>
      <details>
        <summary>Why estimates can differ from Octopus</summary>
        <p>
          Octopus appears to round rewards before converting them back to kWh. Its underlying
          baseline readings also aren’t available through the API, so we can’t reproduce every
          figure exactly.
        </p>
        <p>
          Clock-marked estimates use Home Mini data while standard readings are unavailable. These
          are provisional.
        </p>
        <p>
          A difference alone doesn’t mean your reward is wrong. Open a session’s breakdown to
          inspect the readings and calculation.
        </p>
      </details>
      <a href="https://octopus.energy/blog/saving-sessions-faqs/">Octopus FAQs ↗</a>
      {' · '}
      <a href="https://octopus.energy/Octoplus-terms-and-conditions/">Official terms ↗</a>
    </section>
  );
}
