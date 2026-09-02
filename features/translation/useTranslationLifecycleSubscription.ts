'use client';

import { useEffect, useRef } from 'react';
import type { RuntimeEntityType } from '@echovisionlab/geul-common/collaboration/runtime-events';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { useOptionalEditorRuntimeContext } from '@/lib/contexts/EditorRuntimeContext';
import { useEditorRuntimeEvents } from '@/lib/hooks/useEditorRuntimeEvents';
import {
  translationJobEntityTypeFilterValue,
  type TranslationEntityTypeKey,
  type TranslationLifecycleRefetchHint,
} from '@/lib/translation/lifecycle';

interface UseTranslationLifecycleSubscriptionInput {
  enabled?: boolean;
  provider?: HocuspocusProvider | null;
  entityType?: TranslationEntityTypeKey;
  entityId?: string;
  jobId?: string;
  targetLocale?: string;
  onEvent?: (event: TranslationLifecycleRefetchHint) => Promise<void> | void;
  onReconnect?: () => Promise<void> | void;
}

export function useTranslationLifecycleSubscription({
  enabled = true,
  provider = null,
  entityType,
  entityId,
  jobId,
  targetLocale,
  onEvent,
  onReconnect,
}: UseTranslationLifecycleSubscriptionInput) {
  const onEventRef = useRef<typeof onEvent>(onEvent);
  const onReconnectRef = useRef<typeof onReconnect>(onReconnect);
  const runtimeContext = useOptionalEditorRuntimeContext();
  const effectiveProvider = provider ?? runtimeContext?.provider ?? null;

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    if (!enabled || !effectiveProvider) {
      return;
    }

    let connectEventObserved = false;
    const handleConnect = () => {
      connectEventObserved = true;
      void onReconnectRef.current?.();
    };

    effectiveProvider.on('connect', handleConnect);
    if (!connectEventObserved && (effectiveProvider.isAuthenticated || effectiveProvider.isSynced)) {
      void onReconnectRef.current?.();
    }

    return () => {
      effectiveProvider.off('connect', handleConnect);
    };
  }, [effectiveProvider, enabled]);

  useEditorRuntimeEvents(
    enabled ? effectiveProvider : null,
    (event) => {
      if (event.kind !== 'translation.lifecycle') {
        return;
      }

      const runtimePayload = event.payload;
      if (jobId && runtimePayload.jobId !== jobId) {
        return;
      }
      if (targetLocale && runtimePayload.targetLocale !== targetLocale) {
        return;
      }

      const streamEntityType =
        event.entityType === 'series' ? 'post_series' : (event.entityType as TranslationEntityTypeKey);
      const refetchHint: TranslationLifecycleRefetchHint = {
        jobId: runtimePayload.jobId,
        entityType: streamEntityType,
        entityId: event.entityId,
        targetLocale: runtimePayload.targetLocale,
        timestampMs: event.timestampMs,
      };
      void onEventRef.current?.(refetchHint);
    },
    enabled
      ? {
          entityType: entityType ? (translationJobEntityTypeFilterValue(entityType) as RuntimeEntityType) : undefined,
          entityId,
          locale: targetLocale ?? undefined,
        }
      : undefined,
  );
}
