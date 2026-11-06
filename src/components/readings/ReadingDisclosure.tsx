import { useState, type ReactNode } from 'react';

export function ReadingDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <details className="reading-disclosure" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{title}</summary>
      {open && <div className="reading-disclosure-body">{children}</div>}
    </details>
  );
}
