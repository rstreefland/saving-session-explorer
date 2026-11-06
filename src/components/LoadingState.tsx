export function LoadingState({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="loading-meter" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="loading-copy">
        <strong>Loading your sessions</strong>
        <p>Fetching Octopus results and meter readings.</p>
      </div>
      <button className="quiet" type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
