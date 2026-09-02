'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getOgGenerationRunAction } from '@/lib/actions/og-generation';
import type { OgGenerationRunState } from '@/lib/types/og-generation';

const FAST_WINDOW_MS = 30_000;

function isTerminal(status: OgGenerationRunState['status']): boolean {
  return status === 'ready' || status === 'partially_failed' || status === 'failed' || status === 'cancelled';
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Failed to load OG generation run';
}

export function useOgGenerationRun() {
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<OgGenerationRunState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef(0);
  const trackingEpochRef = useRef(0);
  const currentRunIdRef = useRef<string | null>(null);
  const latestRequestSequenceRef = useRef(0);
  const latestTrackedRequestSequenceRef = useRef(0);

  const trackRun = useCallback((nextRunId: string | null | undefined) => {
    const normalized = nextRunId?.trim();
    if (!normalized) {
      return;
    }
    trackingEpochRef.current += 1;
    currentRunIdRef.current = normalized;
    startedAtRef.current = Date.now();
    setRunId(normalized);
    setRun(null);
    setError(null);
  }, []);

  const beginRunRequest = useCallback((): number => {
    latestRequestSequenceRef.current += 1;
    return latestRequestSequenceRef.current;
  }, []);

  const trackRequestedRun = useCallback(
    (requestSequence: number, nextRunId: string | null | undefined): boolean => {
      const normalized = nextRunId?.trim();
      if (!normalized) {
        return false;
      }
      if (requestSequence < latestTrackedRequestSequenceRef.current) {
        return false;
      }
      latestTrackedRequestSequenceRef.current = requestSequence;
      trackRun(normalized);
      return true;
    },
    [trackRun],
  );

  useEffect(() => {
    if (!runId) {
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const trackingEpoch = trackingEpochRef.current;
    const poll = async () => {
      let result: Awaited<ReturnType<typeof getOgGenerationRunAction>>;
      try {
        result = await getOgGenerationRunAction(runId);
      } catch (queryError) {
        if (stopped || trackingEpochRef.current !== trackingEpoch || currentRunIdRef.current !== runId) {
          return;
        }
        setError(errorMessage(queryError));
        timer = setTimeout(poll, Date.now() - startedAtRef.current < FAST_WINDOW_MS ? 1_000 : 3_000);
        return;
      }
      if (stopped || trackingEpochRef.current !== trackingEpoch || currentRunIdRef.current !== runId) {
        return;
      }
      if (result.error || !result.run) {
        setError(result.error ?? 'Failed to load OG generation run');
      } else {
        setRun(result.run);
        setError(null);
        if (isTerminal(result.run.status)) {
          return;
        }
      }
      timer = setTimeout(poll, Date.now() - startedAtRef.current < FAST_WINDOW_MS ? 1_000 : 3_000);
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [runId]);

  return {
    runId,
    run,
    error,
    isActive: Boolean(runId) && (!run || !isTerminal(run.status)),
    beginRunRequest,
    trackRun,
    trackRequestedRun,
  };
}
