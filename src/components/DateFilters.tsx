import { useRef, useState } from 'react';
import { formatDate } from '../domain/time';
import { last30Days, validRange, type Preset } from '../domain/dateRange';

export function DateFilters({
  from,
  to,
  selected,
  onChange,
}: {
  from: string;
  to: string;
  selected: Preset | 'custom';
  onChange: (from: string, to: string, preset: Preset | 'custom') => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState({ from, to });
  const [open, setOpen] = useState(false);

  return (
    <div className="toolbar">
      <div className="period-buttons" role="group" aria-label="Date range">
        <button
          className={selected === '30d' ? 'selected' : ''}
          aria-pressed={selected === '30d'}
          onClick={() => {
            const range = last30Days();

            onChange(range.from, range.to, '30d');
          }}
        >
          Last 30 days
        </button>
        <button
          className={selected === 'custom' ? 'selected' : ''}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            setDraft({ from, to });
            dialog.current?.showModal();
            setOpen(true);
          }}
        >
          Custom dates
        </button>
      </div>
      <span className="range-caption">
        {formatDate(from)} → {formatDate(to)}
      </span>
      <dialog
        ref={dialog}
        className="date-dialog"
        aria-labelledby="date-dialog-title"
        onClose={() => setOpen(false)}
      >
        <h2 id="date-dialog-title">Custom dates</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();

            if (validRange(draft.from, draft.to)) {
              onChange(draft.from, draft.to, 'custom');
              dialog.current?.close();
            }
          }}
        >
          <label>
            From
            <input
              autoFocus
              type="date"
              value={draft.from}
              max={draft.to}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={draft.to}
              min={draft.from}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </label>
          {!validRange(draft.from, draft.to) && (
            <p role="alert">Choose a date range of up to 366 days.</p>
          )}
          <div className="dialog-actions">
            <button type="button" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button className="primary" disabled={!validRange(draft.from, draft.to)}>
              Apply dates
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
