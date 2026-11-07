export function OctopointsValue({ value }: { value: number }) {
  return (
    <span className="octopoints-value">
      <strong>{value.toLocaleString('en-GB')}</strong>{' '}
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
