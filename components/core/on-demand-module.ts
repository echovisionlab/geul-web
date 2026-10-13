'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A code-split implementation module that Core loads on first use. Once loaded it is available
 * synchronously, so later renders (and other instances) never wait or flash. A failed chunk request
 * clears the pending promise; the next `load()` retries.
 */
export interface OnDemandModule<M> {
  load: () => Promise<M>;
  /** Starts loading; settles (never rejects) when the module is ready or the request failed. */
  preload: () => Promise<void>;
  peek: () => M | undefined;
}

export function onDemandModule<M>(loader: () => Promise<M>): OnDemandModule<M> {
  let loaded: M | undefined;
  let pending: Promise<M> | undefined;
  const result: OnDemandModule<M> = {
    load() {
      if (loaded) {
        return Promise.resolve(loaded);
      }
      pending ??= loader().then(
        (module) => {
          loaded = module;
          return module;
        },
        (error: unknown) => {
          pending = undefined;
          throw error;
        },
      );
      return pending;
    },
    preload() {
      return result.load().then(
        () => undefined,
        () => undefined,
      );
    },
    peek: () => loaded,
  };
  return result;
}

const RETRY_DELAYS_MS = [500, 2000, 5000];

/**
 * Returns the module once it is loaded. Requests it while `needed` is true and retries a failed
 * chunk request a few times with backoff, so a queued dialog or notice is shown once the network
 * recovers instead of being dropped. After the retries, a new request (a change of `request`, for
 * example the queue snapshot) or the browser coming back online starts another round.
 */
export function useOnDemandModule<M>(module: OnDemandModule<M>, needed: boolean, request?: unknown): M | undefined {
  const [loaded, setLoaded] = useState<M | undefined>(module.peek);
  // `round` restarts the retry sequence; `attempt` counts the retries within a round.
  const [retry, setRetry] = useState({ round: 0, attempt: 0 });
  const waiting = !loaded && needed;
  const restart = () => setRetry((current) => ({ round: current.round + 1, attempt: 0 }));
  const lastRequest = useRef(request);
  useEffect(() => {
    const changed = !Object.is(lastRequest.current, request);
    lastRequest.current = request;
    if (changed && waiting) {
      restart();
    }
  }, [request, waiting]);
  useEffect(() => {
    if (!waiting) {
      return;
    }
    window.addEventListener('online', restart);
    return () => window.removeEventListener('online', restart);
  }, [waiting]);
  useEffect(() => {
    if (!waiting) {
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    module.load().then(
      (value) => {
        if (active) {
          setLoaded(() => value);
        }
      },
      () => {
        const delay = RETRY_DELAYS_MS[retry.attempt];
        if (active && delay !== undefined) {
          timer = setTimeout(() => setRetry((current) => ({ ...current, attempt: current.attempt + 1 })), delay);
        }
      },
    );
    return () => {
      active = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [module, retry, waiting]);
  return loaded ?? module.peek();
}

/** Pointer/focus/press handlers that start loading before the user's first activation. */
export function preloadIntentHandlers(preload: () => void) {
  return { onPointerEnter: preload, onFocus: preload, onPointerDown: preload };
}
