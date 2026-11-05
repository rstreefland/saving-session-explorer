import { useCallback, useMemo, useSyncExternalStore } from 'react';

/** Keep the table's actual column count and expanded colSpan aligned with its layout. */
export function useMediaQuery(query: string) {
  const media = useMemo(() => window.matchMedia?.(query), [query]);
  const subscribe = useCallback(
    (onChange: () => void) => {
      media?.addEventListener('change', onChange);
      return () => media?.removeEventListener('change', onChange);
    },
    [media],
  );
  const getSnapshot = useCallback(() => media?.matches ?? false, [media]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
