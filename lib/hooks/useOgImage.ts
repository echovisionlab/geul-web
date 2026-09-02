'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OgGenerationLifecycleRuntimeEvent } from '@echovisionlab/geul-common/collaboration/runtime-events';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { getLatestOgGenerationAction, getOgGenerationAction } from '@/lib/actions/og-generation';
import { getBoundedOgFailureReason } from '@/lib/og-generation-error';
import type { OgGenerationEntityType, OgGenerationState, OgGenerationUiStatus } from '@/lib/types/og-generation';
import { useOgLifecycleSubscription } from './useOgLifecycleSubscription';

const FAST_POLL_WINDOW_MS = 30_000;
const FAST_POLL_INTERVAL_MS = 1_000;
const SLOW_POLL_INTERVAL_MS = 3_000;
const LOCALE_SCOPED_ENTITIES = new Set<OgGenerationEntityType>([
  'post',
  'page',
  'work',
  'artist',
  'series',
  'form',
  'privacy',
  'terms',
]);

export interface UseOgImageOptions {
  entityType: OgGenerationEntityType;
  entityId: string;
  initialOgImageUrl?: string | null;
  locale?: string | null;
  provider: HocuspocusProvider | null;
}

function isTerminal(status: OgGenerationUiStatus): boolean {
  return status === 'ready' || status === 'failed' || status === 'superseded' || status === 'cancelled';
}

function errorMessage(_error: unknown, fallback: string): string {
  return fallback;
}

export function useOgImage(options: UseOgImageOptions) {
  const { entityType, entityId, initialOgImageUrl, locale, provider } = options;
  const targetKey = JSON.stringify([entityType, entityId.trim(), locale?.trim() || null]);
  const localeScoped = LOCALE_SCOPED_ENTITIES.has(entityType);
  const hasLocale = Boolean(locale?.trim());
  const isConcreteTarget = Boolean(entityId.trim()) && (localeScoped ? hasLocale : !hasLocale);
  const router = useRouter();
  const [ogImageUrl, setOgImageUrl] = useState<string | null | undefined>(initialOgImageUrl);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [generation, setGeneration] = useState<OgGenerationState | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const trackingStartedAtRef = useRef(0);
  const trackingEpochRef = useRef(0);
  const currentGenerationIdRef = useRef<string | null>(null);
  const currentTargetKeyRef = useRef(targetKey);
  const currentTargetRef = useRef({ entityType, entityId, locale, targetKey, isConcreteTarget });
  currentTargetKeyRef.current = targetKey;
  currentTargetRef.current = { entityType, entityId, locale, targetKey, isConcreteTarget };
  const latestLookupSequenceRef = useRef(0);
  const refreshedReadyGenerationRef = useRef<string | null>(null);

  useEffect(() => {
    setOgImageUrl(initialOgImageUrl);
  }, [initialOgImageUrl, targetKey]);

  useEffect(() => {
    setGenerationId(null);
    setGeneration(null);
    setLookupError(null);
    trackingStartedAtRef.current = 0;
    trackingEpochRef.current += 1;
    currentGenerationIdRef.current = null;
    latestLookupSequenceRef.current += 1;
  }, [entityId, entityType, locale]);

  const trackGeneration = useCallback(
    (nextGenerationId: string | null | undefined): boolean => {
      if (currentTargetKeyRef.current !== targetKey) {
        return false;
      }
      const normalized = nextGenerationId?.trim();
      if (!normalized) {
        return false;
      }
      latestLookupSequenceRef.current += 1;
      trackingEpochRef.current += 1;
      currentGenerationIdRef.current = normalized;
      trackingStartedAtRef.current = Date.now();
      setGenerationId(normalized);
      setGeneration((current) => (current?.generationId === normalized ? current : null));
      setOgImageUrl(null);
      setLookupError(null);
      return true;
    },
    [targetKey],
  );

  const trackLatest = useCallback(async (): Promise<boolean> => {
    // Automatic runs can complete after a locale switch. Always resolve the
    // target that is current when the callback fires, then bind the response
    // to that target key so an in-flight switch still cannot regress the UI.
    const target = currentTargetRef.current;
    if (!target.isConcreteTarget) {
      return false;
    }
    const requestedTargetKey = target.targetKey;
    const sequence = ++latestLookupSequenceRef.current;
    setLookupError(null);
    let result: Awaited<ReturnType<typeof getLatestOgGenerationAction>>;
    try {
      result = await getLatestOgGenerationAction({
        entityType: target.entityType,
        entityId: target.entityId,
        locale: target.locale,
      });
    } catch (error) {
      if (sequence === latestLookupSequenceRef.current && currentTargetKeyRef.current === requestedTargetKey) {
        setLookupError(errorMessage(error, 'Failed to load latest OG generation'));
      }
      return false;
    }
    if (sequence !== latestLookupSequenceRef.current || currentTargetKeyRef.current !== requestedTargetKey) {
      return false;
    }
    if (result.error) {
      setLookupError('Failed to load latest OG generation');
      return false;
    }
    if (!result.generation) {
      return false;
    }
    if (currentGenerationIdRef.current === result.generation.generationId) {
      // Generation-specific polling owns status progression. Latest discovery
      // only discovers replacement/new IDs and must not regress a newer status
      // with an older response for the same generation.
      return true;
    }
    trackingEpochRef.current += 1;
    currentGenerationIdRef.current = result.generation.generationId;
    trackingStartedAtRef.current = Date.now();
    setGeneration(result.generation);
    setGenerationId(result.generation.generationId);
    if (result.generation.status !== 'ready') {
      setOgImageUrl(null);
    }
    setLookupError(null);
    return true;
  }, []);

  // The initial lookup establishes the latest durable row. After that, lifecycle
  // events and explicit browser/provider wake-ups converge the target without
  // keeping an idle editor on a repeating Server Action request.
  useEffect(() => {
    if (!isConcreteTarget) {
      return;
    }

    void trackLatest();
  }, [isConcreteTarget, provider, targetKey, trackLatest]);

  useEffect(() => {
    if (!isConcreteTarget) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void trackLatest();
      }
    };
    const handleFocus = () => {
      if (document.visibilityState !== 'hidden') {
        void trackLatest();
      }
    };
    const handleOnline = () => {
      void trackLatest();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [isConcreteTarget, targetKey, trackLatest]);

  useEffect(() => {
    if (!isConcreteTarget || !provider || typeof provider.on !== 'function') {
      return;
    }

    const handleProviderStatus = ({ status }: { status?: string }) => {
      if (status === 'connected') {
        void trackLatest();
      }
    };

    provider.on('status', handleProviderStatus);
    return () => {
      provider.off('status', handleProviderStatus);
    };
  }, [isConcreteTarget, provider, targetKey, trackLatest]);

  const trackRequestedGeneration = useCallback(
    (nextGenerationId: string | null | undefined, requestedTargetKey: string): boolean => {
      if (requestedTargetKey !== currentTargetKeyRef.current) {
        return false;
      }
      if (nextGenerationId?.trim()) {
        return trackGeneration(nextGenerationId);
      }
      void trackLatest();
      return true;
    },
    [trackGeneration, trackLatest],
  );

  const handleLifecycle = useCallback(
    (_event: OgGenerationLifecycleRuntimeEvent) => {
      // Events are only a low-latency wake-up. The latest target row remains
      // authoritative, so delayed events cannot regress the UI to an older run.
      void trackLatest();
    },
    [trackLatest],
  );

  useOgLifecycleSubscription(provider, handleLifecycle, {
    enabled: isConcreteTarget,
    entityType,
    entityId,
    locale,
  });

  useEffect(() => {
    if (!generationId) {
      return;
    }

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const trackingEpoch = trackingEpochRef.current;
    const pollTargetKey = targetKey;

    const poll = async () => {
      let result: Awaited<ReturnType<typeof getOgGenerationAction>>;
      try {
        result = await getOgGenerationAction(generationId);
      } catch (error) {
        if (
          stopped ||
          trackingEpochRef.current !== trackingEpoch ||
          currentGenerationIdRef.current !== generationId ||
          currentTargetKeyRef.current !== pollTargetKey
        ) {
          return;
        }
        setLookupError(errorMessage(error, 'Failed to load OG generation'));
        const elapsed = Date.now() - trackingStartedAtRef.current;
        timer = setTimeout(poll, elapsed < FAST_POLL_WINDOW_MS ? FAST_POLL_INTERVAL_MS : SLOW_POLL_INTERVAL_MS);
        return;
      }
      if (
        stopped ||
        trackingEpochRef.current !== trackingEpoch ||
        currentGenerationIdRef.current !== generationId ||
        currentTargetKeyRef.current !== pollTargetKey
      ) {
        return;
      }
      if (result.error || !result.generation) {
        setLookupError('Failed to load OG generation');
      } else {
        const next = result.generation;
        setLookupError(null);
        setGeneration(next);

        if (next.status === 'superseded') {
          if (next.replacementGenerationId) {
            trackingEpochRef.current += 1;
            currentGenerationIdRef.current = next.replacementGenerationId;
            trackingStartedAtRef.current = Date.now();
            setGeneration(null);
            setLookupError(null);
            setGenerationId(next.replacementGenerationId);
          } else {
            setLookupError('Replacement OG generation is missing');
          }
          return;
        }

        if (next.status === 'ready') {
          if (next.assetUrl) {
            setOgImageUrl(next.assetUrl);
          }
          if (refreshedReadyGenerationRef.current !== next.generationId) {
            refreshedReadyGenerationRef.current = next.generationId;
            router.refresh();
          }
          return;
        }
        if (isTerminal(next.status)) {
          return;
        }
      }

      const elapsed = Date.now() - trackingStartedAtRef.current;
      timer = setTimeout(poll, elapsed < FAST_POLL_WINDOW_MS ? FAST_POLL_INTERVAL_MS : SLOW_POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [generationId, router, targetKey]);

  const status: OgGenerationUiStatus | undefined = generation?.status ?? (generationId ? 'queued' : undefined);
  const error =
    generation?.status === 'failed'
      ? getBoundedOgFailureReason(generation.errorCode)
      : generation?.status === 'cancelled'
        ? 'OG generation was cancelled'
        : generation?.status === 'superseded' && !generation.replacementGenerationId
          ? (lookupError ?? 'Replacement OG generation is missing')
          : (lookupError ?? undefined);

  return {
    ogImageUrl,
    src: ogImageUrl || undefined,
    generationId,
    readyGenerationId: status === 'ready' ? generationId : undefined,
    runId: generation?.runId,
    status,
    error,
    isRegenerating: status === 'queued' || status === 'processing',
    trackGeneration,
    trackLatest,
    trackRequestedGeneration,
    targetKey,
    entityType,
    entityId,
    locale,
  };
}
