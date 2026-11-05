import { RewardRoundingExplanation } from './RewardRoundingExplanation';

export function Methodology() {
  return (
    <details id="methodology" className="methodology panel">
      <summary>How the calculation works</summary>
      <p>
        <strong>Power down:</strong> your session usage is compared with your baseline for the same
        time. If your baseline is 1 kWh and you use 0.4 kWh, you shifted 0.6 kWh.
      </p>
      <p>
        <strong>Power up:</strong> the same comparison, but you earn rewards for using more. If your
        baseline is 1 kWh and you use 1.6 kWh, you shifted 0.6 kWh.
      </p>
      <p>
        <strong>Happy Hours:</strong> the electricity imported during your booked hour is added up.
        There is no baseline comparison. The credit depends on your tariff and the session’s rules.
      </p>
      <p>
        <strong>Octopus vs calculated figures:</strong> “Result” comes from Octopus. “Calculated
        result” says whether your meter readings suggest you achieved the session. A complete
        estimate cannot be produced until all the required readings are available.
      </p>
      <p>
        <strong>Calculated reward:</strong> for Power down, shifted energy is multiplied by the
        session’s Octopoints rate. The reward is then rounded up to a whole penny, with a 2p minimum
        assumed for a positive reward. This fits the results checked, but the formula has not been
        confirmed by Octopus. Open a session to see the steps and the difference from the actual
        reward. Power up rewards require tariff rates, so those are not estimated yet.
      </p>
      <details>
        <summary>How your baseline is calculated</summary>
        <p>
          Achieved means you met the target overall. Partly achieved means you met it in some
          half-hours, but not overall. You can still earn Octopoints for those half-hours.
        </p>
        <p>
          For a weekday session that is not a bank holiday, the same half-hours from the last 10
          eligible weekdays are used. For a weekend or bank holiday session, the last 4 eligible
          weekend days are used. Only weekend days are used for that baseline. Up to 60 days of
          history are checked, with bank holidays and known session days left out.
        </p>
        <p>
          Each half-hour is counted separately: using more later does not cancel a reduction
          earlier. For Power down and Power up, electricity you export is included. Happy Hours use
          import readings only.
        </p>
        <p>
          Small differences in energy estimates are normal and are shown only in the reading
          details. A possible missed reward is flagged only when your complete readings suggest you
          achieved a Power down or Power up session and Octopus reports no reward. Pending results
          are never treated as missed rewards. “Reward” is the amount reported by Octopus.
        </p>
      </details>
      <details>
        <summary>Why the kWh figures can differ</summary>
        <RewardRoundingExplanation />
        <p>
          The meter estimate is kept separate from Octopus’s reported figures. Different kWh alone
          do not prove that a reward is wrong. Some baseline totals can also differ, and the API
          does not show the underlying half-hour baselines used by Octopus for these results.
        </p>
      </details>
      <a href="https://octopus.energy/blog/saving-sessions-faqs/">Octopus FAQs ↗</a>
      {' · '}
      <a href="https://octopus.energy/Octoplus-terms-and-conditions/">Official terms ↗</a>
    </details>
  );
}
