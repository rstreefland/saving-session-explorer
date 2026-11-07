import { ProvisionalIndicator } from '../ProvisionalIndicator';
import { PLACEHOLDER } from '../placeholder';
import type { Calculation } from '../../domain/types';
import { isHappyHour } from '../../domain/session';
import { halfHourRange, number } from './format';

function EnergyCard({
  label,
  value,
  note,
  tone,
  provisional,
}: {
  label: string;
  value: number | null;
  note?: string;
  tone?: 'positive' | 'negative';
  provisional?: boolean;
}) {
  return (
    <dl className={'calculation-card' + (tone ? ' calculation-card-' + tone : '')}>
      <dt>
        {label}
        {provisional && value !== null && <ProvisionalIndicator />}
      </dt>
      <dd>
        {number(value)}
        {value !== null && <span className="energy-unit"> kWh</span>}
        {note && <span className="calculation-card-note">{note}</span>}
      </dd>
    </dl>
  );
}

export function CalculationSummary({ result }: { result: Calculation }) {
  const happy = isHappyHour(result.session);
  const up = result.session.eventType === 'TURN_UP';

  return (
    <section className="calculation-summary" aria-label="Calculation summary">
      <h3>
        {happy ? 'How your usage was calculated' : 'How your shifted energy was calculated'}
        {result.provisional && <ProvisionalIndicator />}
      </h3>
      <p className="calculation-explanation">
        {happy
          ? 'Imported electricity is added up half-hour by half-hour. No baseline comparison is needed.'
          : `Each half-hour is counted separately. Only usage ${up ? 'above' : 'below'} baseline counts towards rewards; other half-hours count as zero.`}
      </p>
      {result.rewarded === null && (
        <p className="reading-note">
          This estimate is incomplete. Available readings are shown; missing figures appear as{' '}
          {PLACEHOLDER}.
        </p>
      )}
      <p className="reading-note">Times are UK local time.</p>
      {result.slots.map((slot) => {
        const time = halfHourRange(slot.start);
        const change =
          slot.baseline === null || slot.actual === null
            ? null
            : (slot.baseline - slot.actual) * (up ? -1 : 1);
        const shift = change === null ? null : Math.max(0, change);
        const baseline = <EnergyCard label="Baseline" value={slot.baseline} />;
        const usage = (
          <EnergyCard
            label={happy ? 'Imported' : 'Your usage'}
            value={slot.actual}
            provisional={slot.actualProvisional}
          />
        );

        return (
          <section
            className="half-hour-calculation"
            key={slot.start}
            aria-label={'Half-hour ' + time}
          >
            <h4>
              <time dateTime={slot.start}>{time}</time>
            </h4>
            <div
              className={'calculation-cards' + (happy ? ' single-card' : '')}
              role="group"
              aria-label={
                happy
                  ? 'Imported usage'
                  : up
                    ? 'Your usage minus baseline equals change'
                    : 'Baseline minus your usage equals change'
              }
            >
              {happy ? (
                usage
              ) : (
                <>
                  {up ? usage : baseline}
                  <span className="calculation-operator" aria-hidden="true">
                    −
                  </span>
                  {up ? baseline : usage}
                  <span className="calculation-operator" aria-hidden="true">
                    =
                  </span>
                  <EnergyCard
                    label="Change"
                    value={change}
                    tone={
                      change === null || Math.abs(change) < 1e-9
                        ? undefined
                        : change > 0
                          ? 'positive'
                          : 'negative'
                    }
                    note={
                      shift === null
                        ? 'Awaiting readings'
                        : `${number(shift)} kWh counts towards rewards`
                    }
                  />
                </>
              )}
            </div>
          </section>
        );
      })}
      <dl className="calculation-total">
        <dt>{happy ? 'Total imported' : 'Total shifted for rewards'}</dt>
        <dd>
          {number(result.rewarded)}
          {result.rewarded !== null && <span className="energy-unit"> kWh</span>}
        </dd>
      </dl>
      {happy && (
        <p className="reading-note">
          Octopus calculates the bill credit using your tariff and the session rules.
        </p>
      )}
    </section>
  );
}
