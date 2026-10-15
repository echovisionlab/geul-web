import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FormSchemaPatchFailedError,
  FormSchemaPatchRejectedError,
  requestFormSchemaPatch,
} from './form-schema-protocol';
import { UnretryableSaveError } from '@/lib/editor/save-failure';

const documentName = 'form:11111111-1111-4111-8111-111111111111:en';

function providerMock(name = documentName) {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const provider = {
    configuration: { name },
    hasUnsyncedChanges: false,
    forceSync: vi.fn(),
    flushPendingUpdates: vi.fn(),
    sendStateless: vi.fn(),
    on: vi.fn((event: string, listener: (payload: unknown) => void) => {
      const registered = listeners.get(event) ?? new Set();
      registered.add(listener);
      listeners.set(event, registered);
    }),
    off: vi.fn((event: string, listener: (payload: unknown) => void) => {
      listeners.get(event)?.delete(listener);
    }),
    emit(event: string, payload: unknown) {
      for (const listener of listeners.get(event) ?? []) {
        listener(payload);
      }
    },
    listeners,
  };
  return provider;
}

function patch(requestId = '11111111-1111-4111-8111-111111111111') {
  return {
    requestId,
    documentName,
    previousSchema: { id: 'schema', steps: [] },
    nextSchema: { id: 'schema', steps: [] },
  };
}

afterEach(() => vi.useRealTimers());

describe('requestFormSchemaPatch', () => {
  it('rejects a patch above the server bound without sending it', async () => {
    const provider = providerMock();
    const oversized = { ...patch(), nextSchema: { id: 'schema', text: 'x'.repeat(1024 * 1024) } };
    await expect(requestFormSchemaPatch(provider as never, oversized)).rejects.toBeInstanceOf(
      FormSchemaPatchRejectedError,
    );
    expect(provider.sendStateless).not.toHaveBeenCalled();
  });

  it('settles from a server rejection of a request it could not parse', async () => {
    const provider = providerMock();
    const pending = requestFormSchemaPatch(provider as never, patch());
    await Promise.resolve();
    provider.emit('stateless', {
      payload: JSON.stringify({
        v: 3,
        kind: 'form.schema.patch_result',
        requestId: patch().requestId,
        ok: false,
        error: { code: 'too_large' },
      }),
    });
    await expect(pending).rejects.toThrow('too_large');
  });

  it('sends the active-room patch and resolves only its canonical ACK', async () => {
    const provider = providerMock();
    const pending = requestFormSchemaPatch(provider as never, patch());
    await Promise.resolve();
    const payload = JSON.parse(provider.sendStateless.mock.calls[0]![0] as string);
    expect(payload).toEqual({
      kind: 'form.schema.patch',
      v: 3,
      requestId: patch().requestId,
      previousSchema: patch().previousSchema,
      nextSchema: patch().nextSchema,
    });

    provider.emit('stateless', {
      payload: JSON.stringify({
        kind: 'form.schema.patch_result',
        v: 3,
        requestId: 'other',
        ok: true,
        canonicalSchema: { id: 'wrong', steps: [] },
      }),
    });
    provider.emit('stateless', {
      payload: JSON.stringify({
        kind: 'form.schema.patch_result',
        v: 3,
        requestId: patch().requestId,
        documentName: 'form:other:ko',
        ok: true,
        canonicalSchema: { id: 'wrong-room', steps: [] },
      }),
    });
    provider.emit('stateless', {
      payload: JSON.stringify({
        kind: 'form.schema.patch_result',
        v: 3,
        requestId: patch().requestId,
        ok: true,
        canonicalSchema: { id: 'schema', steps: [{ id: 'canonical', fields: [] }] },
      }),
    });

    await expect(pending).resolves.toEqual({
      id: 'schema',
      steps: [{ id: 'canonical', fields: [] }],
    });
    expect(provider.off).toHaveBeenCalledWith('stateless', expect.any(Function));
    expect(provider.listeners.get('stateless')).toHaveLength(0);
  });

  it('waits for pending Yjs sync before sending the schema command', async () => {
    const provider = providerMock();
    provider.hasUnsyncedChanges = true;
    const pending = requestFormSchemaPatch(provider as never, patch());
    expect(provider.forceSync).toHaveBeenCalledOnce();
    expect(provider.sendStateless).not.toHaveBeenCalled();
    provider.hasUnsyncedChanges = false;
    provider.emit('synced', {});
    await Promise.resolve();
    expect(provider.sendStateless).toHaveBeenCalledOnce();
    provider.emit('stateless', {
      payload: JSON.stringify({
        kind: 'form.schema.patch_result',
        v: 3,
        requestId: patch().requestId,
        ok: true,
        canonicalSchema: patch().nextSchema,
      }),
    });
    await expect(pending).resolves.toEqual(patch().nextSchema);
  });

  it.each([
    [{ code: 'document_revision_changed' }, FormSchemaPatchFailedError, false],
    [{ code: 'schema_invalid', retryable: false }, FormSchemaPatchRejectedError, true],
  ] as const)(
    'preserves the typed server reason %o and whether the save queue may retry it',
    async (error, ErrorType, unretryable) => {
      const provider = providerMock();
      const pending = requestFormSchemaPatch(provider as never, patch());
      await Promise.resolve();
      provider.emit('stateless', {
        payload: JSON.stringify({
          kind: 'form.schema.patch_result',
          v: 3,
          requestId: patch().requestId,
          ok: false,
          error,
        }),
      });
      const failure = await pending.catch((reason: unknown) => reason);
      expect(failure).toBeInstanceOf(ErrorType);
      expect(failure).toMatchObject({ reason: error.code });
      expect(failure instanceof UnretryableSaveError).toBe(unretryable);
    },
  );

  it('rejects an in-flight request immediately when the canonical room must reload', async () => {
    vi.useFakeTimers();
    const provider = providerMock();
    const pending = requestFormSchemaPatch(provider as never, patch());
    const rejection = expect(pending).rejects.toMatchObject({
      name: 'FormSchemaPatchFailedError',
      reason: 'external_update',
    });
    await Promise.resolve();

    provider.emit('stateless', {
      payload: JSON.stringify({ v: 3, kind: 'room.reload', reloadReason: 'external_update' }),
    });

    await rejection;
    expect(provider.off).toHaveBeenCalledWith('stateless', expect.any(Function));
    expect(provider.listeners.get('stateless')).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('refuses to send through a provider for a different active room', async () => {
    const provider = providerMock('form:other:ko');
    await expect(requestFormSchemaPatch(provider as never, patch())).rejects.toThrow(
      'form schema patch room does not match the active provider',
    );
    expect(provider.sendStateless).not.toHaveBeenCalled();
  });

  it('times out without losing the caller-owned patch object', async () => {
    vi.useFakeTimers();
    const provider = providerMock();
    const value = patch();
    const pending = requestFormSchemaPatch(provider as never, value);
    const rejection = expect(pending).rejects.toThrow('form schema patch timed out');
    await vi.advanceTimersByTimeAsync(8_000);
    await rejection;
    expect(value.nextSchema).toEqual({ id: 'schema', steps: [] });
    expect(provider.listeners.get('stateless')).toHaveLength(0);
  });
});
