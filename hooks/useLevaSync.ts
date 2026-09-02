import { useCallback, useEffect, useRef } from 'react';

interface LevaSyncGuard {
  /** onChange wrapper - ignores calls during external sync */
  guardedOnChange: <V>(handler: (v: V) => void) => (v: V) => void;
  /** Execute sync operation with guard flag */
  sync: (set: (values: Record<string, unknown>) => void, values: Record<string, unknown>) => void;
}

/**
 * Creates a Leva sync guard to prevent onChange callbacks from firing
 * during external synchronization (e.g., map interaction, collaboration, tab switching).
 *
 * Leva's set() always triggers onChange synchronously, so we use a flag
 * to distinguish between user-initiated changes and external sync.
 *
 * Usage:
 * 1. Call useLevaSyncGuard() before useControls()
 * 2. Wrap onChange handlers with guardedOnChange()
 * 3. Use sync() in useEffect to update Leva from external changes
 *
 * @example
 * ```tsx
 * const { guardedOnChange, sync } = useLevaSyncGuard();
 *
 * const [, set] = useControls(() => ({
 *   zoom: {
 *     value: config.zoom,
 *     onChange: guardedOnChange((v) => onConfigChange({ zoom: v })),
 *   },
 * }));
 *
 * useEffect(() => {
 *   sync(set, { zoom: config.zoom });
 * }, [config.zoom, set, sync]);
 * ```
 */
export function useLevaSyncGuard(): LevaSyncGuard {
  const isSyncing = useRef(false);
  const isInitialized = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const guardedOnChange = useCallback(
    <V>(handler: (v: V) => void) =>
      (v: V) => {
        if (!isInitialized.current || isSyncing.current) {
          return;
        }
        handler(v);
      },
    [],
  );

  const sync = useCallback((set: (values: Record<string, unknown>) => void, values: Record<string, unknown>) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    isSyncing.current = true;
    set(values);
    syncTimeoutRef.current = setTimeout(() => {
      isSyncing.current = false;
      isInitialized.current = true;
      syncTimeoutRef.current = null;
    }, 0);
  }, []);

  useEffect(
    () => () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    },
    [],
  );

  return { guardedOnChange, sync };
}
