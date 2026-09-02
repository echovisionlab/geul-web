'use client';

import type { HocuspocusProvider } from '@hocuspocus/provider';

const COLLAB_PERSIST_NOW_TIMEOUT_MS = 8_000;
const COLLAB_SYNC_TIMEOUT_MS = 2_500;

function waitForProviderSync(provider: HocuspocusProvider, timeoutMs: number): Promise<void> {
  if (!provider.hasUnsyncedChanges) {
    return Promise.resolve();
  }

  provider.forceSync();

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
  });
}

export async function persistCollaborativeDocumentNow(provider: HocuspocusProvider | null | undefined): Promise<void> {
  if (!provider) {
    throw new Error('collaborative document provider is unavailable');
  }

  await waitForProviderSync(provider, COLLAB_SYNC_TIMEOUT_MS);

  const requestId = `persist-now:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  await new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      cleanup();
      reject(new Error('collaborative document persist timed out'));
    }, COLLAB_PERSIST_NOW_TIMEOUT_MS);

    const handleStateless = (event: { payload?: string } | string) => {
      const raw = typeof event === 'string' ? event : event?.payload;
      if (!raw) {
        return;
      }

      let parsed: {
        kind?: string;
        requestId?: string;
        ok?: boolean;
        error?: string;
      };
      try {
        parsed = JSON.parse(raw) as typeof parsed;
      } catch {
        return;
      }
      if (parsed.kind !== 'persist.now.ack' || parsed.requestId !== requestId) {
        return;
      }

      cleanup();
      if (parsed.ok) {
        resolve();
        return;
      }
      reject(new Error(parsed.error || 'collaborative document persist failed'));
    };

    const cleanup = () => {
      provider.off('stateless', handleStateless);
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    provider.on('stateless', handleStateless);
    provider.sendStateless(
      JSON.stringify({
        kind: 'persist.now.request',
        requestId,
      }),
    );
  });
}
