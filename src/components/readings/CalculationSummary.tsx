import type { Calculation } from '../../domain/types';
import { isHappyHour } from '../../domain/session';
import { sessionOutcome } from '../../domain/outcome';
import { number } from './format';

function explanation(result: Calculation) {
  const outcome = sessionOutcome(result);
  if (result.rewarded === null)
    return 'This calculation cannot be completed yet. The available readings are shown below.';
  if (isHappyHour(result.session))
    return 'Electricity imported during your booked hour is added up. No baseline comparison is needed.';
  const up = result.session.eventType === 'TURN_UP';
  if (outcome.code === 'achieved')
    return `You used ${number(Math.abs(result.netSaved!))} kWh ${up ? 'more' : 'less'} than baseline over the whole session.`;
  if (outcome.code === 'partly-achieved')
    return `You used ${up ? 'more' : 'less'} in some half-hours, but not over the session as a whole. Those half-hours still count towards rewards.`;
  return `You did not use ${up ? 'more' : 'less'} than baseline in any half-hour.`;
}

function EnergyCard({
  step,
  label,
  value,
  note,
  overBaseline = false,
}: {
  step: number;
  label: string;
  value: number | null;
  note: string;
  overBaseline?: boolean;
}) {
  return (
    <dl className={'calculation-card' + (overBaseline ? ' calculation-card-over-baseline' : '')}>
      <dt>
        <span className="calculation-step" aria-hidden="true">
          {step}
        </span>
        {label}
      </dt>
      <dd>
        {number(value)}
        {value !== null && <span className="energy-unit"> kWh</span>}
        <span className="calculation-card-note">{note}</span>
      </dd>
    </dl>
  );
}

export function CalculationSummary({ result }: { result: Calculation }) {
  const happy = isHappyHour(result.session);
  const outcome = sessionOutcome(result);
  const change = result.netSaved;
  const up = result.session.eventType === 'TURN_UP';
  const baselineCard = (
    <EnergyCard
      step={up ? 2 : 1}
      label="Baseline"
      value={result.baseline}
      note={
        result.days.length
          ? `Average of ${result.days.length} similar days`
          : 'Reference readings unavailable'
      }
    />
  );
  const usageCard = (
    <EnergyCard
      step={happy || up ? 1 : 2}
      label="Your usage"
      value={result.actual}
      note={
        happy ? 'Electricity imported during this hour' : 'Electricity used during this session'
      }
    />
  );
  return (
    <section className="calculation-summary" aria-label="Calculation summary">
      <div className="calculation-heading">
        <h3>{happy ? 'How your usage was calculated' : 'How your result was calculated'}</h3>
        {!happy && (
          <span className={'calculation-outcome outcome-' + outcome.tone}>{outcome.label}</span>
        )}
      </div>
      <p className="calculation-explanation">{explanation(result)}</p>
      <div
        className={'calculation-cards' + (happy ? ' single-card' : '')}
        role="group"
        aria-label={
          happy
            ? 'Metered usage'
            : up
              ? 'Your usage minus baseline equals overall change'
              : 'Baseline minus your usage equals overall change'
        }
      >
        {happy ? (
          usageCard
        ) : (
          <>
            {up ? usageCard : baselineCard}
            <span className="calculation-operator" aria-hidden="true">
              −
            </span>
            {up ? baselineCard : usageCard}
            <span className="calculation-operator" aria-hidden="true">
              =
            </span>
            <EnergyCard
              step={3}
              label="Overall change"
              overBaseline={change !== null && change < -1e-9}
              value={change === null ? null : change * (up ? -1 : 1)}
              note={
                change === null
                  ? 'Waiting for a complete calculation'
                  : Math.abs(change) < 1e-9
                    ? 'Same as baseline'
                    : change > 0
                      ? 'Less than baseline'
                      : 'More than baseline'
              }
            />
          </>
        )}
      </div>
      {happy && (
        <p className="reading-note">
          Octopus calculates the bill credit using your tariff and the session rules.
        </p>
      )}
    </section>
  );
}
