'use client';

import { useCallback, useRef, useState } from 'react';

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown> | null)?.then === 'function';
}

function report(error: unknown, onError?: (error: unknown) => void) {
  if (!onError) {
    // eslint-disable-next-line no-console -- The single Core fallback when a caller supplies no domain feedback.
    console.error('Core command failed', error);
    return;
  }
  void Promise.resolve()
    .then(() => onError(error))
    .catch((handlerError: unknown) => report(handlerError));
}

/**
 * Pending state for a Core control that owns its command trigger. A command that returns a promise keeps
 * the trigger pending until it settles and ignores repeated activation meanwhile; a synchronous command
 * never becomes pending. Failures go to `onError`, which owns domain feedback.
 */
export function usePendingAction() {
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const run = useCallback((action: (() => unknown) | undefined, onError?: (error: unknown) => void) => {
    if (running.current || !action) {
      return;
    }
    let result: unknown;
    try {
      result = action();
    } catch (error) {
      report(error, onError);
      return;
    }
    if (!isPromiseLike(result)) {
      return;
    }
    running.current = true;
    setPending(true);
    void Promise.resolve(result)
      .then(undefined, (error: unknown) => report(error, onError))
      .finally(() => {
        running.current = false;
        setPending(false);
      });
  }, []);
  return { pending, run };
}
