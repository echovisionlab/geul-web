'use client';

import type { HocuspocusProvider } from '@hocuspocus/provider';

export const FORM_SCHEMA_PATCH_KIND = 'form.schema.patch';
export const FORM_SCHEMA_PATCH_ACK_KIND = 'form.schema.patch.ack';
export const FORM_SCHEMA_CHANGED_KIND = 'form.schema.changed';
export const FORM_SCHEMA_PROTOCOL_VERSION = 1;

const FORM_SCHEMA_PATCH_TIMEOUT_MS = 8_000;
const FORM_SCHEMA_SYNC_TIMEOUT_MS = 2_500;

export interface FormSchemaPatch {
  requestId: string;
  documentName: string;
  previousSchema: unknown;
  nextSchema: unknown;
}

interface FormSchemaPatchAck {
  kind?: string;
  reason?: string;
  protocolVersion?: number;
  requestId?: string;
  documentName?: string;
  ok?: boolean;
  canonicalSchema?: unknown;
  error?: string;
}

export class FormSchemaPatchRejectedError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'FormSchemaPatchRejectedError';
  }
}

function waitForProviderSync(provider: HocuspocusProvider): Promise<void> {
  if (!provider.hasUnsyncedChanges) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      cleanup();
      reject(new Error('collaborative document sync timed out'));
    }, FORM_SCHEMA_SYNC_TIMEOUT_MS);
    const maybeResolve = () => {
      if (settled || provider.hasUnsyncedChanges) {
        return;
      }
      settled = true;
      cleanup();
      resolve();
    };
    const onSynced = () => maybeResolve();
    const onUnsyncedChanges = () => maybeResolve();
    const cleanup = () => {
      provider.off('synced', onSynced);
      provider.off('unsyncedChanges', onUnsyncedChanges);
      clearTimeout(timer);
    };

    provider.on('synced', onSynced);
    provider.on('unsyncedChanges', onUnsyncedChanges);
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
  await waitForProviderSync(provider);

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
      let result: FormSchemaPatchAck;
      try {
        result = JSON.parse(raw) as FormSchemaPatchAck;
      } catch {
        return;
      }
      if (result.kind === 'reload_required' && (result.reason === undefined || result.reason === 'reload_required')) {
        cleanup();
        reject(new FormSchemaPatchRejectedError('reload_required'));
        return;
      }
      if (
        result.kind !== FORM_SCHEMA_PATCH_ACK_KIND ||
        result.protocolVersion !== FORM_SCHEMA_PROTOCOL_VERSION ||
        result.requestId !== patch.requestId ||
        result.documentName !== patch.documentName
      ) {
        return;
      }
      cleanup();
      if (result.ok && result.canonicalSchema !== undefined) {
        resolve(result.canonicalSchema);
      } else {
        reject(new FormSchemaPatchRejectedError(result.error || 'form schema patch failed'));
      }
    };

    provider.on('stateless', onStateless);
    try {
      provider.sendStateless(
        JSON.stringify({
          kind: FORM_SCHEMA_PATCH_KIND,
          protocolVersion: FORM_SCHEMA_PROTOCOL_VERSION,
          ...patch,
        }),
      );
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
