'use client';

import { createLogger } from '@/lib/utils/logger';
import { UnretryableSaveError } from '@/lib/editor/save-failure';
import {
  encodeMessage,
  fitsClientMessageBound,
  parseServerMessage,
  type ClientMessageOf,
} from '@echovisionlab/geul-common/collaboration/protocol';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { waitForProviderSync } from './hocuspocus-provider';

const FORM_SCHEMA_PATCH_TIMEOUT_MS = 8_000;
const FORM_SCHEMA_SYNC_TIMEOUT_MS = 2_500;

export type FormSchemaPatch = Omit<ClientMessageOf<'form.schema.patch'>, 'kind' | 'v'> & { documentName: string };

/** A patch that failed transiently or was interrupted by a room rebuild; the save queue retries it. */
export class FormSchemaPatchFailedError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'FormSchemaPatchFailedError';
  }
}

/** A patch collab refused for good (validation, permission or size); it is never retried. */
export class FormSchemaPatchRejectedError extends UnretryableSaveError {
  constructor(reason: string, message = reason) {
    super(message, reason);
    this.name = 'FormSchemaPatchRejectedError';
  }
}

export async function requestFormSchemaPatch(
  provider: HocuspocusProvider | null | undefined,
  patch: FormSchemaPatch,
): Promise<unknown> {
  if (!provider) {
    throw new Error('collaborative document provider is unavailable');
  }
  if (provider.configuration.name !== patch.documentName) {
    throw new Error('form schema patch room does not match the active provider');
  }
  const frame = encodeMessage({
    kind: 'form.schema.patch',
    requestId: patch.requestId,
    previousSchema: patch.previousSchema,
    nextSchema: patch.nextSchema,
  });
  // The server drops frames above its bound; fail here instead of waiting for the timeout.
  if (!fitsClientMessageBound('form.schema.patch', frame)) {
    throw new FormSchemaPatchRejectedError('too_large');
  }
  provider.flushPendingUpdates();
  await waitForProviderSync(provider, FORM_SCHEMA_SYNC_TIMEOUT_MS);
  provider.flushPendingUpdates();

  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
      cleanup();
      reject(new Error('form schema patch timed out'));
    }, FORM_SCHEMA_PATCH_TIMEOUT_MS);
    const cleanup = () => {
      provider.off('stateless', onStateless);
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    const onStateless = (event: { payload?: string } | string) => {
      const raw = typeof event === 'string' ? event : event?.payload;
      if (!raw) {
        return;
      }
      const parsed = parseServerMessage(raw);
      if (!parsed.ok) {
        void createLogger('collaboration').warn('Ignoring collaboration message', { data: { ...parsed } });
        return;
      }
      const result = parsed.message;
      if (result.kind === 'room.reload' || result.kind === 'room.access_ended') {
        cleanup();
        // The room is rebuilding or access ended: the patch is retried once the room is back.
        reject(new FormSchemaPatchFailedError(result.kind === 'room.reload' ? result.reloadReason : result.reason));
        return;
      }
      if (result.kind !== 'form.schema.patch_result' || result.requestId !== patch.requestId) {
        return;
      }
      cleanup();
      if (result.ok) {
        resolve(result.canonicalSchema);
      } else {
        reject(
          result.error.retryable === false && !result.error.reloadReason
            ? new FormSchemaPatchRejectedError(result.error.code, result.error.message ?? result.error.code)
            : new FormSchemaPatchFailedError(result.error.code),
        );
      }
    };

    provider.on('stateless', onStateless);
    try {
      provider.sendStateless(frame);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
