'use client';

import type { EditorRuntimeEvent, RuntimeEntityType } from '@echovisionlab/geul-common/collaboration/runtime-events';
import type { HocuspocusProvider } from '@hocuspocus/provider';

export interface EditorRuntimeEventSubscriptionOptions {
  entityType?: RuntimeEntityType;
  entityId?: string;
  locale?: string | null;
  /**
   * Called when received events could not be delivered because the event parser chunk failed to
   * load after retries. Refetch the state those events would have updated.
   */
  onResync?: () => void;
}

export type EditorRuntimeEventListener = (event: EditorRuntimeEvent) => void;

type RuntimeEventParser = (payload: string) => EditorRuntimeEvent | null;

// Backoff for a failed parser chunk request. After the last step the queued events are replaced by
// a resync; the next event or the browser coming back online starts another round.
const PARSER_RETRY_DELAYS_MS = [1000, 3000, 10000];

let runtimeEventParser: RuntimeEventParser | null = null;
let runtimeEventParserLoad: Promise<RuntimeEventParser> | null = null;

/**
 * Common's runtime-event parser validates with classic zod, which cannot be tree-shaken (about
 * 87 kB gzip). It loads when the first provider subscription starts, not with every route that can
 * upload a file (`/my/*`, admin pages without a collaboration provider).
 */
function loadRuntimeEventParser(): Promise<RuntimeEventParser> {
  runtimeEventParserLoad ??= import('@echovisionlab/geul-common/collaboration/runtime-events').then(
    (module) => {
      runtimeEventParser = module.parseEditorRuntimeEventMessage;
      return runtimeEventParser;
    },
    (error: unknown) => {
      runtimeEventParserLoad = null;
      throw error;
    },
  );
  return runtimeEventParserLoad;
}

export function subscribeToProviderRuntimeEvents(
  provider: HocuspocusProvider | null,
  onEvent: EditorRuntimeEventListener,
  options?: EditorRuntimeEventSubscriptionOptions,
): () => void {
  if (!provider) {
    return () => {};
  }

  const hasLocaleFilter = options != null && Object.hasOwn(options, 'locale') && options.locale !== undefined;

  let active = true;
  // Payloads received before the parser chunk arrives, delivered in order once it has loaded.
  let pending: string[] | null = null;
  let loading = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const deliver = (parse: RuntimeEventParser, payload: string) => {
    const event = parse(payload);
    if (!event) {
      return;
    }

    if (options?.entityType && event.entityType !== options.entityType) {
      return;
    }
    if (options?.entityId && event.entityId !== options.entityId) {
      return;
    }
    if (hasLocaleFilter) {
      const expectedLocale = options?.locale?.trim() || '';
      const payloadLocale = event.locale?.trim() || '';
      if (expectedLocale !== payloadLocale) {
        return;
      }
    }

    onEvent(event);
  };

  const flushPending = (parse: RuntimeEventParser) => {
    const queued = pending;
    pending = null;
    if (!active || !queued) {
      return;
    }
    for (const payload of queued) {
      deliver(parse, payload);
    }
  };

  // Loads the parser for the queued payloads. A failed chunk request keeps the queue and retries
  // with backoff; when the retries are exhausted the consumer refetches instead (the queued
  // payloads are superseded by that state, so they are not delivered later out of date).
  const requestParser = () => {
    if (!active || loading || retryTimer !== undefined || !pending) {
      return;
    }
    loading = true;
    loadRuntimeEventParser().then(
      (parse) => {
        loading = false;
        attempt = 0;
        flushPending(parse);
      },
      () => {
        loading = false;
        if (!active) {
          return;
        }
        const delay = PARSER_RETRY_DELAYS_MS[attempt];
        if (delay !== undefined) {
          attempt += 1;
          retryTimer = setTimeout(() => {
            retryTimer = undefined;
            requestParser();
          }, delay);
          return;
        }
        attempt = 0;
        pending = null;
        options?.onResync?.();
      },
    );
  };

  const retryNow = () => {
    if (retryTimer !== undefined) {
      clearTimeout(retryTimer);
      retryTimer = undefined;
    }
    attempt = 0;
    requestParser();
  };

  const handleStateless = ({ payload }: { payload: string }) => {
    if (runtimeEventParser && !pending) {
      deliver(runtimeEventParser, payload);
      return;
    }
    (pending ??= []).push(payload);
    requestParser();
  };

  provider.on('stateless', handleStateless);
  const online = typeof window === 'undefined' ? null : window;
  online?.addEventListener('online', retryNow);
  loadRuntimeEventParser().catch(() => {});
  return () => {
    active = false;
    pending = null;
    if (retryTimer !== undefined) {
      clearTimeout(retryTimer);
    }
    online?.removeEventListener('online', retryNow);
    provider.off('stateless', handleStateless);
  };
}
