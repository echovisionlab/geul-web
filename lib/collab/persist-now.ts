'use client';

import { getProviderAccessEnded } from './provider-control-state';
import { createLogger } from '@/lib/utils/logger';
import { encodeMessage, parseServerMessage } from '@echovisionlab/geul-common/collaboration/protocol';
import * as Y from 'yjs';
import { blockRoomDurabilityStateCovers } from './block-room-durability';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { waitForProviderSync } from './hocuspocus-provider';

const COLLAB_PERSIST_NOW_TIMEOUT_MS = 8_000;
const COLLAB_SYNC_TIMEOUT_MS = 2_500;

export async function persistCollaborativeDocumentNow(provider: HocuspocusProvider | null | undefined): Promise<void> {
  if (!provider) {
    throw new Error('collaborative document provider is unavailable');
  }

  if (getProviderAccessEnded(provider)) {
    throw new Error(getProviderAccessEnded(provider));
  }
  provider.flushPendingUpdates();
  await waitForProviderSync(provider, COLLAB_SYNC_TIMEOUT_MS);

  if (getProviderAccessEnded(provider)) {
    throw new Error(getProviderAccessEnded(provider));
  }
  // sendStateless does not drain the provider's data-plane batching buffer. Capture the
  // coverage and drain again in the same turn as room.flush, including edits made
  // while awaiting sync. WebSocket ordering makes the server see the updates first.
  const expected = {
    stateVector: Y.encodeStateVector(provider.document),
    deleted: Object.fromEntries(Y.decodeUpdate(Y.encodeStateAsUpdate(provider.document)).ds.clients),
  };
  provider.flushPendingUpdates();

  const requestId = crypto.randomUUID();
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

      const result = parseServerMessage(raw);
      if (!result.ok) {
        void createLogger('collaboration').warn('Ignoring collaboration message', { data: { ...result } });
        return;
      }
      if (result.message.kind === 'room.reload' || result.message.kind === 'room.access_ended') {
        cleanup();
        reject(new Error(result.message.kind === 'room.reload' ? result.message.reloadReason : result.message.reason));
        return;
      }
      if (result.message.kind !== 'room.flush_result' || result.message.requestId !== requestId) {
        return;
      }
      const parsed = result.message;
      cleanup();
      if (parsed.ok) {
        try {
          const stateVector = Uint8Array.from(atob(parsed.persisted.stateVector), (character) =>
            character.charCodeAt(0),
          );
          if (!blockRoomDurabilityStateCovers({ stateVector, deleted: parsed.persisted.deleted }, expected)) {
            reject(new Error('collaborative document flush did not cover local edits'));
            return;
          }
          resolve();
        } catch {
          reject(new Error('invalid collaboration durability coverage'));
        }
        return;
      }
      reject(new Error(parsed.error.message ?? parsed.error.code));
    };

    const cleanup = () => {
      provider.off('stateless', handleStateless);
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    provider.on('stateless', handleStateless);
    try {
      provider.sendStateless(encodeMessage({ kind: 'room.flush', requestId }));
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
