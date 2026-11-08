import { decimal, minimum, maximum } from '../domain/decimal';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Tooltip({ label, text, icon }: { label: string; text: string; icon?: ReactNode }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const open = position !== null;

  function show() {
    clearTimeout(hideTimer.current);

    const target = trigger.current;
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    const width = minimum(320, decimal(window.innerWidth).minus(24));
    const height = popup.current?.getBoundingClientRect().height ?? 0;
    const below = decimal(bounds.bottom).plus(8);

    setPosition({
      top: below.plus(height).lte(decimal(window.innerHeight).minus(12))
        ? below.toNumber()
        : maximum(12, decimal(bounds.top).minus(height).minus(8)).toNumber(),
      left: maximum(
        12,
        minimum(bounds.left, decimal(window.innerWidth).minus(width).minus(12)),
      ).toNumber(),
    });
  }

  useLayoutEffect(() => {
    if (!open || !popup.current || !trigger.current) return;

    const anchor = trigger.current.getBoundingClientRect();
    const height = popup.current.getBoundingClientRect().height;
    const below = decimal(anchor.bottom).plus(8);

    const top = below.plus(height).lte(decimal(window.innerHeight).minus(12))
      ? below.toNumber()
      : maximum(12, decimal(anchor.top).minus(height).minus(8)).toNumber();

    setPosition((previous) => (previous && previous.top !== top ? { ...previous, top } : previous));
  }, [open, text]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  useEffect(() => {
    if (!open) return;

    const hide = () => setPosition(null);

    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };

    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    window.addEventListener('keydown', dismiss);

    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('keydown', dismiss);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={'tooltip-trigger' + (icon ? ' tooltip-icon' : '')}
        aria-label={icon ? label : undefined}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={() => {
          hideTimer.current = setTimeout(() => setPosition(null), 150);
        }}
        onFocus={show}
        onBlur={() => setPosition(null)}
        onClick={show}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setPosition(null);
        }}
      >
        {icon ?? label}
      </button>
      {position &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="tooltip"
            className="tooltip"
            style={position}
            onMouseEnter={() => clearTimeout(hideTimer.current)}
            onMouseLeave={() => setPosition(null)}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}
