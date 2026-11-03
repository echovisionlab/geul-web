'use client';

import { useEffect, useRef, useState } from 'react';

/** Tracks a command's returned promise without disabling its focused control. */
export function usePendingAction<T>(action: () => void | Promise<T>) {
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = () => {
    if (running.current) {
      return;
    }
    const result = action();
    if (!result || typeof result.then !== 'function') {
      return;
    }
    running.current = true;
    setPending(true);
    const finish = () => {
      running.current = false;
      if (mounted.current) {
        setPending(false);
      }
    };
    const pendingPromise = Promise.resolve(result).finally(finish);
    // Observe event-handler failures separately so callers still receive the result or rejection.
    void pendingPromise.catch((error: unknown) => {
      // eslint-disable-next-line no-console -- Callers own domain feedback; keep unhandled failures observable.
      console.error('Core command failed', error);
    });
    return pendingPromise;
  };
  return { pending, run };
}
