import { MessageType, type HocuspocusProvider, type onOutgoingMessageParameters } from '@hocuspocus/provider';

/**
 * Fixed batching window for outgoing document updates and awareness (Hocuspocus `flushDelay`).
 * Updates in one window travel as one merged frame. 250 ms keeps peers' typing visibly live while
 * sending at most four frames a second per typist; Notion batches its writes at 500 ms. Page hide
 * sends the buffer immediately, and the intent journal holds every edit until it is persisted.
 */
export const COLLAB_FLUSH_DELAY_MS = 250;

/**
 * Preserve the resident socket when updating provider configuration.
 * HocuspocusProvider creates a new websocket provider when setConfiguration
 * receives no websocketProvider, even if the provider already owns one.
 */
export function setHocuspocusResumeToken(provider: HocuspocusProvider, token: string): void {
  provider.setConfiguration({
    token,
    websocketProvider: provider.configuration.websocketProvider,
  });
}

/**
 * Send buffered document updates as soon as the page is hidden or unloaded. The provider batches
 * updates for `COLLAB_FLUSH_DELAY_MS`; a tab closed inside that window would otherwise drop them before they reach
 * collab or the intent journal. Hidden is the last event mobile browsers reliably deliver.
 */
export function flushHocuspocusUpdatesOnPageHide(
  provider: Pick<HocuspocusProvider, 'flushPendingUpdates'>,
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const flush = () => provider.flushPendingUpdates();
  const flushWhenHidden = () => {
    if (document.visibilityState === 'hidden') {
      flush();
    }
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', flushWhenHidden);
  return () => {
    window.removeEventListener('pagehide', flush);
    document.removeEventListener('visibilitychange', flushWhenHidden);
  };
}

/** Resolves once the provider has no unsynced local changes; forces a sync round trip first. */
export function waitForProviderSync(provider: HocuspocusProvider, timeoutMs: number): Promise<void> {
  if (!provider.hasUnsyncedChanges) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      settled = true;
      cleanup();
      reject(new Error('collaborative document sync timed out'));
    }, timeoutMs);

    const maybeResolve = () => {
      if (settled || provider.hasUnsyncedChanges) {
        return;
      }
      settled = true;
      cleanup();
      resolve();
    };

    const handleSynced = () => {
      maybeResolve();
    };
    const handleUnsyncedChanges = () => {
      maybeResolve();
    };

    const cleanup = () => {
      provider.off('synced', handleSynced);
      provider.off('unsyncedChanges', handleUnsyncedChanges);
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    provider.on('synced', handleSynced);
    provider.on('unsyncedChanges', handleUnsyncedChanges);
    try {
      provider.forceSync();
      maybeResolve();
    } catch (error) {
      settled = true;
      cleanup();
      reject(error);
    }
  });
}

/**
 * Runs `beforeSend` right before the provider sends document state: batched updates, sync step
 * messages and the untyped replies it sends to the server's sync step 1. Awareness and stateless
 * frames carry no document state and are skipped.
 */
export function beforeHocuspocusDocumentSend(
  provider: Pick<HocuspocusProvider, 'on' | 'off'>,
  beforeSend: () => void,
): () => void {
  const listener = ({ message }: onOutgoingMessageParameters) => {
    if (message.type === undefined || message.type === MessageType.Sync) {
      beforeSend();
    }
  };
  provider.on('outgoingMessage', listener);
  return () => provider.off('outgoingMessage', listener);
}

/**
 * Closes the provider's socket and opens a new one, so the room readmits it (for example with
 * edit access granted while open). `disconnect()` closes asynchronously and a `connect()` made
 * before the close event is a no-op, which would leave the provider disconnected; the connect
 * waits for the provider's `disconnect` event. `shouldConnect` is checked again at that point.
 * Returns a cancel that drops a pending reconnect.
 */
export function reconnectHocuspocusProvider(
  provider: Pick<HocuspocusProvider, 'on' | 'off' | 'connect' | 'disconnect'> & {
    configuration: { websocketProvider?: { status?: unknown } };
  },
  shouldConnect: () => boolean,
): () => void {
  let pending = true;
  const cancel = () => {
    pending = false;
    provider.off('disconnect', connectAfterClose);
  };
  function connectAfterClose() {
    if (!pending) {
      return;
    }
    cancel();
    if (shouldConnect()) {
      void provider.connect();
    }
  }
  // WebSocketStatus.Disconnected; no socket to close, so no disconnect event follows.
  if (provider.configuration.websocketProvider?.status === 'disconnected') {
    connectAfterClose();
    return cancel;
  }
  provider.on('disconnect', connectAfterClose);
  provider.disconnect();
  return cancel;
}

const ADMISSION_RETRY_MIN_MS = 1_000;
const ADMISSION_RETRY_MAX_MS = 30_000;

export interface AdmissionRetry {
  /** Readmits after a jittered, doubling delay; a pending retry is not rescheduled. */
  schedule: () => void;
  /** The room admitted the provider: drops a pending retry; the next refusal starts over. */
  reset: () => void;
  cancel: () => void;
}

/**
 * Retries a temporarily refused admission (`isAdmissionRetryReason`: the collab host is stopping,
 * or authorization was unreachable). Hocuspocus keeps the socket open but unauthenticated after
 * a refusal, so the retry reopens it; local state and journals stay as they are.
 */
export function createAdmissionRetry(
  provider: Parameters<typeof reconnectHocuspocusProvider>[0],
  shouldConnect: () => boolean,
): AdmissionRetry {
  let delay = ADMISSION_RETRY_MIN_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelReconnect = () => {};
  return {
    schedule() {
      if (timer) {
        return;
      }
      const wait = delay / 2 + Math.random() * (delay / 2);
      delay = Math.min(delay * 2, ADMISSION_RETRY_MAX_MS);
      timer = setTimeout(() => {
        timer = null;
        if (shouldConnect()) {
          cancelReconnect();
          cancelReconnect = reconnectHocuspocusProvider(provider, shouldConnect);
        }
      }, wait);
    },
    reset() {
      // Admitted (possibly by the provider's own reconnect): a pending retry would only
      // disconnect the healthy socket.
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      delay = ADMISSION_RETRY_MIN_MS;
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      cancelReconnect();
    },
  };
}
