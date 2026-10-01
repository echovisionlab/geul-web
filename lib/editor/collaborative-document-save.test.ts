import * as Y from 'yjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BlockRoomDurabilityProtocol, BlockRoomDurabilityState } from '@/lib/collab/block-room-durability';
import { persistCollaborativeDocumentNow } from '@/lib/collab/persist-now';
import { flushEditorSaves, hasPendingEditorSaves } from './editor-save-registry';
import { createHocuspocusProviderFixture } from '@/features/editor/hocuspocusProvider.test-fixture';
import {
  createCollaborativeDocumentSaveTracker,
  createCollaborativeDocumentReplayOrigin,
  registerCollaborativeDocumentSave,
} from './collaborative-document-save';

vi.mock('@/lib/collab/persist-now', () => ({
  persistCollaborativeDocumentNow: vi.fn(),
}));

const persistNow = vi.mocked(persistCollaborativeDocumentNow);
const unregisterCallbacks: Array<() => void> = [];
const documents: Y.Doc[] = [];
const providerFixtures: Array<ReturnType<typeof createHocuspocusProviderFixture>> = [];

function createDurabilityProtocol() {
  const listeners = new Set<(state: BlockRoomDurabilityState) => void>();
  const protocol: BlockRoomDurabilityProtocol = {
    subscribePersisted: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    protocol,
    emit: (state: BlockRoomDurabilityState) => listeners.forEach((listener) => listener(state)),
  };
}

function currentDurabilityState(document: Y.Doc): BlockRoomDurabilityState {
  const update = Y.decodeUpdate(Y.encodeStateAsUpdate(document));
  return {
    stateVector: Y.encodeStateVector(document),
    deleted: Object.fromEntries(
      [...update.ds.clients.entries()].map(([client, ranges]) => [
        String(client),
        ranges.map(({ clock, len }) => ({ clock, len })),
      ]),
    ),
  };
}

function attachDocumentSave(documentKey = 'post:post-1') {
  const fixture = createHocuspocusProviderFixture(documentKey);
  providerFixtures.push(fixture);
  const provider = fixture.provider;
  const document = provider.document;
  documents.push(document);
  unregisterCallbacks.push(registerCollaborativeDocumentSave(provider, documentKey));
  return { document, provider };
}

function attachBlockRoomDocumentSave(documentKey = 'post:post-1') {
  const fixture = createHocuspocusProviderFixture(documentKey);
  providerFixtures.push(fixture);
  const provider = fixture.provider;
  const document = provider.document;
  documents.push(document);
  const durability = createDurabilityProtocol();
  unregisterCallbacks.push(
    registerCollaborativeDocumentSave(provider, documentKey, { kind: 'block-room', protocol: durability.protocol }),
  );
  return { document, provider, durability };
}

afterEach(() => {
  vi.useRealTimers();
  unregisterCallbacks.splice(0).forEach((unregister) => unregister());
  providerFixtures.splice(0).forEach((fixture) => fixture.destroy());
  documents.splice(0).forEach((document) => document.destroy());
  persistNow.mockReset();
});

describe('registerCollaborativeDocumentSave', () => {
  it('keeps semantic replay pending despite the remote flag on Y.applyUpdate', async () => {
    const { document } = attachDocumentSave();
    const staged = new Y.Doc();
    staged.getMap('content').set('title', 'Recovered author intent');
    Y.applyUpdate(document, Y.encodeStateAsUpdate(staged), createCollaborativeDocumentReplayOrigin());
    staged.destroy();
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);
    persistNow.mockRejectedValueOnce(new Error('not durable')).mockResolvedValueOnce();
    await expect(flushEditorSaves('post:post-1')).resolves.toBe(false);
    await expect(flushEditorSaves('post:post-1')).resolves.toBe(true);
  });
  it('ignores remote document changes and remains clean until a local edit', async () => {
    const { document, provider } = attachDocumentSave();
    persistNow.mockResolvedValue();

    const remoteDocument = new Y.Doc();
    remoteDocument.getMap('content').set('title', 'Remote title');
    Y.applyUpdate(document, Y.encodeStateAsUpdate(remoteDocument), 'remote');
    remoteDocument.destroy();

    // Some provider-side metadata projections use a local Y transaction with
    // the provider as origin; these are still not authored document edits.
    document.transact(() => {
      document.getMap('collaboration-revision').set('documentRevision', 'server-projected-revision');
    }, provider);

    expect(hasPendingEditorSaves('post:post-1')).toBe(false);
    expect(await flushEditorSaves('post:post-1')).toBe(true);
    expect(persistNow).not.toHaveBeenCalled();

    document.getMap('content').set('title', 'Local title');
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);
    expect(await flushEditorSaves('post:post-1')).toBe(true);
    expect(persistNow).toHaveBeenCalledTimes(1);
    expect(persistNow).toHaveBeenCalledWith(expect.objectContaining({ document }));
    expect(hasPendingEditorSaves('post:post-1')).toBe(false);
  });

  it('drains local edits made while an earlier persistence request is in flight', async () => {
    const { document } = attachDocumentSave();
    let completeFirst = () => {};
    persistNow
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            completeFirst = resolve;
          }),
      )
      .mockResolvedValueOnce();

    document.getMap('content').set('title', 'First edit');
    const flush = flushEditorSaves('post:post-1');
    expect(persistNow).toHaveBeenCalledTimes(1);

    document.getMap('content').set('summary', 'Edit while saving');
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);

    completeFirst();
    await expect(flush).resolves.toBe(true);
    expect(persistNow).toHaveBeenCalledTimes(2);
    expect(hasPendingEditorSaves('post:post-1')).toBe(false);
  });

  it('keeps a failed local revision pending and retries it on a later flush', async () => {
    const { document } = attachDocumentSave();
    persistNow.mockRejectedValueOnce(new Error('write failed')).mockResolvedValueOnce();
    document.getMap('content').set('title', 'Retry me');

    await expect(flushEditorSaves('post:post-1')).resolves.toBe(false);
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);
    await expect(flushEditorSaves('post:post-1')).resolves.toBe(true);
    expect(persistNow).toHaveBeenCalledTimes(2);
    expect(hasPendingEditorSaves('post:post-1')).toBe(false);
  });

  it('keeps a local revision pending after transport sync until its automatic persist.now ACK', async () => {
    vi.useFakeTimers();
    const { document, provider } = attachDocumentSave();
    const persistAcknowledgement = deferred<void>();
    persistNow.mockReturnValueOnce(persistAcknowledgement.promise);

    document.getMap('content').set('title', 'Automatic persistence');
    expect(provider.unsyncedChanges).toBe(1);
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);
    expect(persistNow).not.toHaveBeenCalled();

    provider.decrementUnsyncedChanges();
    expect(provider.unsyncedChanges).toBe(0);
    expect(provider.isSynced).toBe(true);
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(persistNow).toHaveBeenCalledOnce());
    expect(persistNow).toHaveBeenCalledWith(provider);
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);

    persistAcknowledgement.resolve(undefined);
    await vi.waitFor(() => expect(hasPendingEditorSaves('post:post-1')).toBe(false));
    expect(persistNow).toHaveBeenCalledOnce();
  });

  it('retains pending intent when an automatic persist.now request rejects without busy retrying', async () => {
    vi.useFakeTimers();
    const { document, provider } = attachDocumentSave();
    persistNow.mockRejectedValueOnce(new Error('write failed'));

    document.getMap('content').set('title', 'Automatic failure');
    provider.decrementUnsyncedChanges();
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(persistNow).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(10_000);
    await Promise.resolve();
    await Promise.resolve();

    expect(hasPendingEditorSaves('post:post-1')).toBe(true);
    expect(persistNow).toHaveBeenCalledOnce();
  });

  it('drains a newer edit only after its own persist.now ACK', async () => {
    vi.useFakeTimers();
    const { document, provider } = attachDocumentSave();
    const firstAcknowledgement = deferred<void>();
    const secondAcknowledgement = deferred<void>();
    persistNow.mockReturnValueOnce(firstAcknowledgement.promise).mockReturnValueOnce(secondAcknowledgement.promise);

    document.getMap('content').set('title', 'First edit');
    provider.decrementUnsyncedChanges();
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(persistNow).toHaveBeenCalledTimes(1));

    document.getMap('content').set('summary', 'Edit while saving');
    expect(provider.unsyncedChanges).toBe(1);
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);
    let navigationSettled = false;
    const navigationFlush = flushEditorSaves('post:post-1').then((saved) => {
      navigationSettled = true;
      return saved;
    });
    provider.decrementUnsyncedChanges();
    firstAcknowledgement.resolve(undefined);

    await vi.waitFor(() => expect(persistNow).toHaveBeenCalledTimes(2));
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);
    expect(navigationSettled).toBe(false);
    secondAcknowledgement.resolve(undefined);
    await expect(navigationFlush).resolves.toBe(true);
    expect(hasPendingEditorSaves('post:post-1')).toBe(false);
    expect(persistNow).toHaveBeenCalledTimes(2);
  });

  it('coalesces a burst of synced edits into one automatic persist.now request', async () => {
    vi.useFakeTimers();
    const { document, provider } = attachDocumentSave();
    const persistAcknowledgement = deferred<void>();
    persistNow.mockReturnValueOnce(persistAcknowledgement.promise);

    for (let edit = 0; edit < 20; edit += 1) {
      document.getMap('content').set(`title-${edit}`, `Edit ${edit}`);
      provider.decrementUnsyncedChanges();
    }

    expect(hasPendingEditorSaves('post:post-1')).toBe(true);
    expect(persistNow).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(persistNow).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(persistNow).toHaveBeenCalledOnce());
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);
    persistAcknowledgement.resolve(undefined);
    await vi.waitFor(() => expect(hasPendingEditorSaves('post:post-1')).toBe(false));
    expect(persistNow).toHaveBeenCalledOnce();
  });

  it('debounces one follow-up after a bounded automatic flush leaves newer work pending', async () => {
    vi.useFakeTimers();
    const { document, provider } = attachDocumentSave();
    const acknowledgements: Array<ReturnType<typeof deferred<void>>> = [];
    persistNow.mockImplementation(() => {
      const acknowledgement = deferred<void>();
      acknowledgements.push(acknowledgement);
      return acknowledgement.promise;
    });

    document.getMap('content').set('title', 'Edit 0');
    provider.decrementUnsyncedChanges();
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(persistNow).toHaveBeenCalledTimes(1));

    for (let round = 0; round < 4; round += 1) {
      document.getMap('content').set('title', `Edit ${round + 1}`);
      provider.decrementUnsyncedChanges();
      acknowledgements[round].resolve(undefined);
      if (round < 3) {
        await vi.waitFor(() => expect(persistNow).toHaveBeenCalledTimes(round + 2));
      }
    }

    await vi.waitFor(() => expect(hasPendingEditorSaves('post:post-1')).toBe(true));
    expect(persistNow).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(persistNow).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(persistNow).toHaveBeenCalledTimes(5));
    acknowledgements[4].resolve(undefined);
    await vi.waitFor(() => expect(hasPendingEditorSaves('post:post-1')).toBe(false));
    expect(persistNow).toHaveBeenCalledTimes(5);
  });

  it('does not auto-persist when transport sync arrives after the tracker is unregistered', async () => {
    vi.useFakeTimers();
    const { document, provider } = attachDocumentSave();

    document.getMap('content').set('title', 'Old room edit');
    expect(provider.unsyncedChanges).toBe(1);
    unregisterCallbacks.pop()?.();
    provider.decrementUnsyncedChanges();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(persistNow).not.toHaveBeenCalled();
  });

  it('does not start another automatic persist.now round after unregistering during a request', async () => {
    vi.useFakeTimers();
    const fixture = createHocuspocusProviderFixture('post:post-1');
    providerFixtures.push(fixture);
    const { provider } = fixture;
    const document = provider.document;
    documents.push(document);
    const tracker = createCollaborativeDocumentSaveTracker(provider);
    const unregister = tracker.register('post:post-1');
    unregisterCallbacks.push(unregister);
    const firstAcknowledgement = deferred<void>();
    persistNow.mockReturnValueOnce(firstAcknowledgement.promise);

    document.getMap('content').set('title', 'First edit');
    provider.decrementUnsyncedChanges();
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(persistNow).toHaveBeenCalledOnce());

    document.getMap('content').set('summary', 'Pending when unregistering');
    provider.decrementUnsyncedChanges();
    const inFlight = tracker.flush();
    unregister();
    unregisterCallbacks.pop();
    firstAcknowledgement.resolve(undefined);

    await expect(inFlight).resolves.toBe(false);
    expect(tracker.hasPending()).toBe(true);
    expect(persistNow).toHaveBeenCalledOnce();
  });

  it('waits for a covering durable ACK when persist.now responds first', async () => {
    const { document, durability } = attachBlockRoomDocumentSave();
    persistNow.mockResolvedValue();
    document.getMap('content').set('title', 'Local edit');

    let settled = false;
    const flush = flushEditorSaves('post:post-1').then((result) => {
      settled = true;
      return result;
    });
    await Promise.resolve();
    expect(persistNow).toHaveBeenCalledOnce();
    expect(settled).toBe(false);
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);

    durability.emit(currentDurabilityState(document));
    await expect(flush).resolves.toBe(true);
    expect(hasPendingEditorSaves('post:post-1')).toBe(false);
  });

  it('keeps a newer local edit pending when an older durable ACK arrives', async () => {
    const { document, durability } = attachBlockRoomDocumentSave();
    const firstRequest = deferred<void>();
    persistNow.mockReturnValueOnce(firstRequest.promise).mockResolvedValueOnce();

    document.getMap('content').set('first', 'first edit');
    const firstAcknowledgement = currentDurabilityState(document);
    const flushing = flushEditorSaves('post:post-1');
    await Promise.resolve();
    document.getMap('content').set('second', 'newer edit');
    firstRequest.resolve(undefined);
    await Promise.resolve();

    durability.emit(firstAcknowledgement);
    await Promise.resolve();
    expect(persistNow).toHaveBeenCalledTimes(2);
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);

    durability.emit(currentDurabilityState(document));
    await expect(flushing).resolves.toBe(true);
    expect(hasPendingEditorSaves('post:post-1')).toBe(false);
  });

  it('retains pending intent when the durable ACK does not arrive within its bounded wait', async () => {
    vi.useFakeTimers();
    const { document } = attachBlockRoomDocumentSave();
    persistNow.mockResolvedValue();
    document.getMap('content').set('title', 'Still not durable');

    const flushing = flushEditorSaves('post:post-1');
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(8_001);
    await expect(flushing).resolves.toBe(false);
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
