'use client';

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { LayoutInline } from '../Layout';
import { TextButton } from '../TextButton';
import { Text } from '../Typography';
import { Spinner } from './Display';
import classes from './NearEndLoader.module.css';

export interface NearEndLoadOptions {
  /** Opaque identity of the next page. Null means the result set is exhausted. */
  pageKey: string | null;
  /** Changes when the entity, query, sort or filter replaces the result set. */
  resetKey: string;
  /** Optional scroll root. Otherwise the closest scrolling ancestor or document viewport is used. */
  rootRef?: RefObject<HTMLElement | null>;
  loading?: boolean;
  error?: string | null;
  onLoad: () => Promise<void>;
}

/** Transport remains with the caller; each cursor is automatically attempted once per result set. */
export function useNearEndLoad({ pageKey, resetKey, rootRef, loading = false, error, onLoad }: NearEndLoadOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef(onLoad);
  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const inFlightRef = useRef<string | null>(null);
  const attemptedRef = useRef(new Set<string>());
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [automatic, setAutomatic] = useState(false);
  const key = JSON.stringify([resetKey, pageKey]);

  useEffect(() => {
    loadRef.current = onLoad;
  }, [onLoad]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
    };
  }, []);
  useEffect(() => {
    generationRef.current += 1;
    inFlightRef.current = null;
    attemptedRef.current.clear();
    setPendingKey(null);
    setFailedKey(null);
  }, [resetKey]);

  const request = useCallback(
    async (manual = true) => {
      if (pageKey === null || loading || inFlightRef.current !== null || (!manual && (error || failedKey === key))) {
        return;
      }
      if (!manual && attemptedRef.current.has(key)) {
        return;
      }
      const generation = generationRef.current;
      inFlightRef.current = key;
      attemptedRef.current.add(key);
      setPendingKey(key);
      setFailedKey(null);
      try {
        await loadRef.current();
      } catch {
        if (mountedRef.current && generationRef.current === generation) {
          setFailedKey(key);
        }
      } finally {
        if (mountedRef.current && generationRef.current === generation && inFlightRef.current === key) {
          inFlightRef.current = null;
          setPendingKey(null);
        }
      }
    },
    [error, failedKey, key, loading, pageKey],
  );

  useEffect(() => {
    const supported = typeof IntersectionObserver === 'function';
    setAutomatic(supported);
    const target = sentinelRef.current;
    if (!supported || !target || pageKey === null || loading || pendingKey === key || error || failedKey === key) {
      return;
    }
    const explicitRoot = rootRef?.current;
    let scrollRoot = explicitRoot && explicitRoot.scrollHeight > explicitRoot.clientHeight ? explicitRoot : null;
    if (!scrollRoot) {
      for (let ancestor = target.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (
          /(auto|scroll|overlay)/.test(getComputedStyle(ancestor).overflowY) &&
          ancestor.scrollHeight > ancestor.clientHeight
        ) {
          scrollRoot = ancestor;
          break;
        }
      }
    }
    let observer: IntersectionObserver | undefined;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            void request(false);
          }
        },
        { root: scrollRoot, rootMargin: '240px 0px' },
      );
      observer.observe(target);
    } catch {
      observer?.disconnect();
      setAutomatic(false);
      return;
    }
    return () => observer?.disconnect();
  }, [error, failedKey, key, loading, pageKey, pendingKey, request, rootRef]);

  return {
    sentinelRef,
    request: () => request(true),
    automatic,
    loading: loading || pendingKey === key,
    failed: Boolean(error) || failedKey === key,
  };
}

export interface NearEndLoaderLabels {
  load: string;
  loading: string;
  end: string;
  retry: string;
  failed: string;
}
export interface NearEndLoaderProps extends NearEndLoadOptions {
  labels: NearEndLoaderLabels;
}

/** Automatic continuation with a keyboard command, bounded failure and explicit end status. */
export function NearEndLoader({ labels, ...options }: NearEndLoaderProps) {
  const state = useNearEndLoad(options);
  const statusId = useId();
  const [commandFocused, setCommandFocused] = useState(false);
  const ended = options.pageKey === null;
  return (
    <div ref={state.sentinelRef} className={classes.root} data-near-end-loader>
      {state.failed ? (
        <Text size="xs" tone="danger" role="alert">
          {options.error || labels.failed}
        </Text>
      ) : null}
      <LayoutInline gap="xs" align="center">
        <Text id={statusId} size="xs" tone="secondary" role="status" aria-live="polite" aria-atomic="true">
          {state.loading ? labels.loading : ended ? labels.end : ''}
        </Text>
        {state.loading ? <Spinner size="xs" /> : null}
        {!ended || commandFocused ? (
          <span className={classes.command} data-automatic={(state.automatic && !state.failed) || undefined}>
            <TextButton
              size="xs"
              appearance="muted"
              aria-disabled={state.loading || ended}
              aria-describedby={ended ? statusId : undefined}
              onFocus={() => setCommandFocused(true)}
              onBlur={() => setCommandFocused(false)}
              onClick={() => void state.request()}
            >
              {state.failed ? labels.retry : labels.load}
            </TextButton>
          </span>
        ) : null}
      </LayoutInline>
    </div>
  );
}
