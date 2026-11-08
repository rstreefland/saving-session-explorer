import { formatNumeric, type Numeric, type Decimal } from '../domain/decimal';
export function OctopointsValue({ value }: { value: Numeric | Decimal }) {
  return (
    <span className="octopoints-value">
      <strong>{formatNumeric(value)}</strong>{' '}
      <small className="points-unit">
        <span className="reward-unit-full" aria-hidden="true">
          Octopoints
        </span>
        <abbr className="reward-unit-short" title="Octopoints" aria-hidden="true">
          pts
        </abbr>
        <span className="sr-only">Octopoints</span>
      </small>
    </span>
  );
}
