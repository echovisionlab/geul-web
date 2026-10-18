import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { persistCollaborativeDocumentNow } from './persist-now';

function providerFixture() {
  const listeners = new Map<string, Set<(event: { payload?: string }) => void>>();
  const emit = (name: string, event = {}) => {
    for (const listener of [...(listeners.get(name) ?? [])]) {
      listener(event);
    }
  };
  const provider = {
    document: new Y.Doc(),
    hasUnsyncedChanges: true,
    flushPendingUpdates: vi.fn(),
    forceSync: vi.fn(),
    on: (name: string, listener: (event: { payload?: string }) => void) => {
      const group = listeners.get(name) ?? new Set();
      group.add(listener);
      listeners.set(name, group);
    },
    off: (name: string, listener: (event: { payload?: string }) => void) => listeners.get(name)?.delete(listener),
    sendStateless: vi.fn(),
  };
  const ack = (ok = true) => {
    const request = JSON.parse(provider.sendStateless.mock.calls.at(-1)![0]);
    emit('stateless', {
      payload: JSON.stringify({
        v: 3,
        kind: 'room.flush_result',
        requestId: request.requestId,
        ok,
        ...(ok
          ? {
              persisted: {
                stateVector: Buffer.from(Y.encodeStateVector(provider.document)).toString('base64'),
                deleted: {},
              },
            }
          : { error: { code: 'save_rejected', message: 'save rejected' } }),
      }),
    });
  };
  return {
    provider,
    emit,
    ack,
    listeners,
    persist: () => persistCollaborativeDocumentNow(provider as unknown as HocuspocusProvider),
  };
}

afterEach(() => vi.useRealTimers());

describe('persistCollaborativeDocumentNow', () => {
  it.each([null, undefined])('fails when the collaboration provider is %s', async (provider) => {
    await expect(persistCollaborativeDocumentNow(provider)).rejects.toThrow(
      'collaborative document provider is unavailable',
    );
  });

  it('waits for synchronization and the matching durable persistence acknowledgement', async () => {
    const { provider, emit, ack, persist, listeners } = providerFixture();
    const completed = vi.fn();
    const saving = persist().then(completed);
    expect(provider.sendStateless).not.toHaveBeenCalled();
    provider.hasUnsyncedChanges = false;
    emit('unsyncedChanges');
    await Promise.resolve();
    expect(provider.sendStateless).toHaveBeenCalledOnce();
    emit('stateless', { payload: JSON.stringify({ kind: 'persist.now.ack', requestId: 'another-request', ok: true }) });
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    ack();
    await saving;
    expect(completed).toHaveBeenCalledOnce();
    expect([...listeners.values()].every((group) => group.size === 0)).toBe(true);
  });

  it('does not miss a synchronous forced synchronization', async () => {
    vi.useFakeTimers();
    const { provider, emit, ack, persist } = providerFixture();
    provider.forceSync.mockImplementation(() => {
      provider.hasUnsyncedChanges = false;
      emit('synced');
    });
    const saving = persist();
    await Promise.resolve();
    expect(provider.sendStateless).toHaveBeenCalledOnce();
    ack();
    await saving;
  });

  it('rejects a failed durable save and removes its acknowledgement listener', async () => {
    const { provider, ack, persist, listeners } = providerFixture();
    provider.hasUnsyncedChanges = false;
    const saving = persist();
    await Promise.resolve();
    const rejected = expect(saving).rejects.toThrow('save rejected');
    ack(false);
    await rejected;
    expect(listeners.get('stateless')?.size).toBe(0);
  });

  it('fails closed when synchronization times out', async () => {
    vi.useFakeTimers();
    const { provider, persist, listeners } = providerFixture();
    const saving = persist();
    const rejected = expect(saving).rejects.toThrow('sync timed out');
    await vi.advanceTimersByTimeAsync(2500);
    await rejected;
    expect(provider.sendStateless).not.toHaveBeenCalled();
    expect([...listeners.values()].every((group) => group.size === 0)).toBe(true);
  });
});

it('drains the data buffer again before room.flush and requires coverage of edits made during sync', async () => {
  const { provider, emit, persist } = providerFixture();
  const writes: string[] = [];
  let buffered = true;
  provider.flushPendingUpdates.mockImplementation(() => {
    if (buffered) {
      writes.push('update');
    }
    buffered = false;
  });
  provider.sendStateless.mockImplementation(() => {
    writes.push('room.flush');
  });
  const saving = persist();
  provider.document.getText('body').insert(0, 'new edit');
  buffered = true;
  provider.hasUnsyncedChanges = false;
  emit('synced');
  await Promise.resolve();
  expect(writes).toEqual(['update', 'update', 'room.flush']);
  const request = JSON.parse(provider.sendStateless.mock.calls[0]![0]);
  const rejected = expect(saving).rejects.toThrow('did not cover local edits');
  emit('stateless', {
    payload: JSON.stringify({
      v: 3,
      kind: 'room.flush_result',
      requestId: request.requestId,
      ok: true,
      persisted: { stateVector: 'AA==', deleted: {} },
    }),
  });
  await rejected;
  provider.document.destroy();
});

it('requires durable coverage of deletions as well as client clocks', async () => {
  const { provider, emit, persist } = providerFixture();
  provider.document.getText('body').insert(0, 'delete me');
  provider.document.getText('body').delete(0, 9);
  provider.hasUnsyncedChanges = false;
  const saving = persist();
  await Promise.resolve();
  const request = JSON.parse(provider.sendStateless.mock.calls[0]![0]);
  const rejected = expect(saving).rejects.toThrow('did not cover local edits');
  emit('stateless', {
    payload: JSON.stringify({
      v: 3,
      kind: 'room.flush_result',
      requestId: request.requestId,
      ok: true,
      persisted: { stateVector: Buffer.from(Y.encodeStateVector(provider.document)).toString('base64'), deleted: {} },
    }),
  });
  await rejected;
  provider.document.destroy();
});
