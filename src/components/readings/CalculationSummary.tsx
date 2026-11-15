import { positive, type Decimal } from '../../domain/decimal';
import { ProvisionalIndicator } from '../ProvisionalIndicator';
import { PLACEHOLDER } from '../placeholder';
import type { Calculation } from '../../domain/types';
import { isHappyHour } from '../../domain/session';
import { halfHourRange, number } from './format';
import { ReadingDisclosure } from './ReadingDisclosure';

function EnergyValue({
  label,
  value,
  tone,
  provisional,
}: {
  label: string;
  value: Decimal | null;
  tone?: 'positive' | 'negative';
  provisional?: boolean;
}) {
  return (
    <dl className={'calculation-value' + (tone ? ' calculation-value-' + tone : '')}>
      <dt>
        {label}
        {provisional && value !== null && <ProvisionalIndicator />}
      </dt>
      <dd>{number(value)}</dd>
    </dl>
  );
}

export function CalculationSummary({ result }: { result: Calculation }) {
  const happy = isHappyHour(result.session);
  const up = result.session.eventType === 'TURN_UP';

  return (
    <section className="calculation-summary" aria-label="Calculation summary">
      <div className="calculation-heading">
        <h3>
          {happy ? 'Imported energy' : 'How your energy was shifted'}
          {result.provisional && <ProvisionalIndicator />}
        </h3>
        <span>All values in kWh</span>
      </div>
      <p className="calculation-explanation">
        {happy
          ? 'No baseline comparison is needed.'
          : `Only usage ${up ? 'above' : 'below'} baseline counts towards rewards.`}
      </p>
      {result.rewarded === null && (
        <p className="reading-note">
          This estimate is incomplete. Available readings are shown; missing figures appear as{' '}
          {PLACEHOLDER}.
        </p>
      )}
      {result.slots.map((slot) => {
        const time = halfHourRange(slot.start);
        const change =
          slot.baseline === null || slot.actual === null
            ? null
            : slot.baseline.minus(slot.actual).times(up ? -1 : 1);
        const shift = change === null ? null : positive(change);
        const baseline = <EnergyValue label="Baseline" value={slot.baseline} />;
        const usage = (
          <EnergyValue
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
              className={'calculation-values' + (happy ? ' import-only' : '')}
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
                  <EnergyValue
                    label="Change"
                    value={change}
                    tone={
                      change === null || change.abs().lt('0.000000001')
                        ? undefined
                        : change.gt(0)
                          ? 'positive'
                          : 'negative'
                    }
                  />
                  <dl className="calculation-contribution">
                    <dt>Counts for rewards</dt>
                    <dd>
                      {number(shift)}
                      {shift !== null && <span className="energy-unit"> kWh</span>}
                      {shift === null && <span className="reading-note">Awaiting readings</span>}
                    </dd>
                  </dl>
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
      <ReadingDisclosure title="How this is calculated">
        <p>
          {happy
            ? 'Imported electricity is added up half-hour by half-hour. No baseline comparison is needed.'
            : `Each half-hour is counted separately. Only usage ${up ? 'above' : 'below'} baseline counts towards rewards; other half-hours count as zero.`}
        </p>
        {!happy && (
          <p>Power down and Power up use electricity imported minus electricity exported.</p>
        )}
      </ReadingDisclosure>
      {happy && (
        <p className="reading-note">
          Octopus calculates the bill credit using your tariff and the session rules.
        </p>
      )}
    </section>
  );
}
