// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDebouncedPatch } from './debounced-patch';
import { useDebouncedPatch } from './useDebouncedPatch';
import { flushAllEditorSaves, flushEditorSaves } from './editor-save-registry';
import {
  activateEditorSaveRecoveryQueue,
  clearEditorSaveRecovery,
  deactivateEditorSaveRecoveryQueue,
  persistEditorSaveRecoveryEntry,
  readEditorSaveRecovery,
} from './editor-save-recovery';

let root: Root;
let host: HTMLDivElement;
let edit: ReturnType<typeof useDebouncedPatch<{ title?: string; summary?: string }>>;
function Editor({ room, write }: { room: object; write: (patch: object) => Promise<void> | void }) {
  edit = useDebouncedPatch({ write, delay: 500, scope: room, document: 'work:one' });
  return null;
}
beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement('div');
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  clearEditorSaveRecovery('work-room:one:en');
  clearEditorSaveRecovery('page-room:one:en');
  clearEditorSaveRecovery('artist:one:en');
  window.sessionStorage.clear();
  vi.useRealTimers();
});

it('merges fields across rerenders and retains the input-time writer until saved', async () => {
  const room = {};
  const oldWriter = vi.fn(),
    nextWriter = vi.fn();
  act(() =>
    root.render(
      <StrictMode>
        <Editor room={room} write={oldWriter} />
      </StrictMode>,
    ),
  );
  act(() => edit({ title: 'title' }));
  act(() =>
    root.render(
      <StrictMode>
        <Editor room={room} write={nextWriter} />
      </StrictMode>,
    ),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(oldWriter).toHaveBeenCalledExactlyOnceWith({ title: 'title' });
  expect(nextWriter).not.toHaveBeenCalled();
  act(() => {
    edit({ title: 'new' });
    edit({ summary: 'summary' });
  });
  await act(async () => {
    expect(await flushEditorSaves('work:one')).toBe(true);
  });
  expect(nextWriter).toHaveBeenCalledExactlyOnceWith({ title: 'new', summary: 'summary' });
});

it('never sends pending old-locale text or a stale handler through a new room', async () => {
  const oldWriter = vi.fn(),
    nextWriter = vi.fn();
  act(() => root.render(<Editor room={{}} write={oldWriter} />));
  const staleEdit = edit;
  act(() => edit({ title: '한국어' }));
  act(() => root.render(<Editor room={{}} write={nextWriter} />));
  act(() => {
    staleEdit({ summary: 'old event' });
    edit({ title: 'English' });
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(oldWriter).not.toHaveBeenCalled();
  expect(nextWriter).toHaveBeenCalledExactlyOnceWith({ title: 'English' });
});

it('archives pending fields on unmount and never treats an archived batch as acknowledged', async () => {
  const documentKey = 'work:one';
  const recoveryScope = 'work-room:one:en';
  const oldWriter = vi.fn();
  function RecoverableEditor({ write }: { write: (patch: object) => Promise<void> | void }) {
    edit = useDebouncedPatch({
      write,
      delay: 500,
      scope: 'work-one',
      document: documentKey,
      recoveryScope,
    });
    return null;
  }

  act(() => root.render(<RecoverableEditor write={oldWriter} />));
  act(() => edit({ title: 'archived title' }));
  expect(readEditorSaveRecovery(recoveryScope)).toBeNull();
  act(() => root.unmount());

  const archived = readEditorSaveRecovery(recoveryScope);
  expect(archived?.entries).toMatchObject([{ document: documentKey, patch: { title: 'archived title' } }]);
  expect(oldWriter).not.toHaveBeenCalled();
  await expect(flushAllEditorSaves(documentKey)).resolves.toBe(true);

  const currentWriter = vi.fn();
  root = createRoot(host);
  act(() => root.render(<RecoverableEditor write={currentWriter} />));
  act(() => edit({ summary: 'new room edit' }));
  await act(async () => {
    await expect(flushAllEditorSaves(documentKey)).resolves.toBe(true);
  });

  expect(currentWriter).toHaveBeenCalledExactlyOnceWith({ summary: 'new room edit' });
  expect(currentWriter).not.toHaveBeenCalledWith({ title: 'archived title' });
  const retainedArchive = readEditorSaveRecovery(recoveryScope);
  expect(retainedArchive?.entries).toMatchObject([{ patch: { title: 'archived title' } }]);
  clearEditorSaveRecovery(
    recoveryScope,
    retainedArchive?.entries.map((entry) => entry.id),
  );
  await expect(flushAllEditorSaves(documentKey)).resolves.toBe(true);
});

it('keeps recovery batches from separate queues under the same room scope', () => {
  const recoveryScope = 'page-room:one:en';
  let editLayout: ReturnType<typeof useDebouncedPatch<{ layout?: string }>>;
  let editMetadata: ReturnType<typeof useDebouncedPatch<{ title?: string }>>;
  function TwoQueues() {
    editLayout = useDebouncedPatch({
      write: vi.fn(),
      delay: 500,
      scope: 'same-room',
      document: 'page:one',
      recoveryScope,
    });
    editMetadata = useDebouncedPatch({
      write: vi.fn(),
      delay: 500,
      scope: 'same-room',
      document: 'page:one',
      recoveryScope,
    });
    return null;
  }

  act(() => root.render(<TwoQueues />));
  act(() => {
    editLayout({ layout: 'layout patch' });
    editMetadata({ title: 'metadata patch' });
  });
  act(() => root.unmount());

  const archived = readEditorSaveRecovery(recoveryScope);
  expect(archived?.entries).toHaveLength(2);
  expect(archived?.entries.map((entry) => entry.patch)).toEqual(
    expect.arrayContaining([{ layout: 'layout patch' }, { title: 'metadata patch' }]),
  );
});

it('keeps an in-memory recovery copy when session storage rejects writes', () => {
  const recoveryScope = 'artist:one:en';
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage quota exceeded');
  });
  const write = vi.fn();
  function RecoverableEditor() {
    edit = useDebouncedPatch({
      write,
      delay: 500,
      scope: 'artist-one',
      document: 'artist:one',
      recoveryScope,
    });
    return null;
  }

  try {
    act(() => root.render(<RecoverableEditor />));
    act(() => edit({ title: 'memory fallback' }));
    act(() => root.unmount());
  } finally {
    setItem.mockRestore();
  }

  expect(readEditorSaveRecovery(recoveryScope)?.entries).toMatchObject([
    { document: 'artist:one', patch: { title: 'memory fallback' } },
  ]);
  clearEditorSaveRecovery(recoveryScope);
});

it('automatically resumes an exact keyed orphan after an unmounted failed save', async () => {
  const recoveryScope = 'work-room:resume:en';
  const failedWriter = vi.fn(async () => {
    throw new Error('offline');
  });
  function RecoverableEditor({ write }: { write: (patch: object) => Promise<void> | void }) {
    edit = useDebouncedPatch({
      write,
      delay: 500,
      scope: 'work-room:resume',
      document: 'work:resume:en',
      recoveryScope,
      recoveryKey: 'work-metadata',
    });
    return null;
  }

  act(() => root.render(<RecoverableEditor write={failedWriter} />));
  act(() => edit({ title: 'retained after failure' }));
  await act(async () => expect(await edit.flush()).toBe(false));
  act(() => root.unmount());
  expect(readEditorSaveRecovery(recoveryScope)?.entries).toMatchObject([
    { document: 'work:resume:en', recoveryKey: 'work-metadata', patch: { title: 'retained after failure' } },
  ]);

  const recoveredWriter = vi.fn();
  root = createRoot(host);
  act(() => root.render(<RecoverableEditor write={recoveredWriter} />));
  await act(async () => vi.advanceTimersByTimeAsync(500));

  expect(failedWriter).toHaveBeenCalledExactlyOnceWith({ title: 'retained after failure' });
  expect(recoveredWriter).toHaveBeenCalledExactlyOnceWith({ title: 'retained after failure' });
  expect(readEditorSaveRecovery(recoveryScope)).toBeNull();
});

it('restores a pending patch across a same-room reconnect and persists the replacement before retry', async () => {
  const recoveryScope = 'page-room:stable:en';
  const originalWriter = vi.fn();
  let editLayout!: ReturnType<typeof useDebouncedPatch<{ layout: string }>>;
  function ReconnectableEditor({ room, write }: { room: object; write: (patch: { layout: string }) => void }) {
    editLayout = useDebouncedPatch<{ layout: string }>({
      write,
      delay: 500,
      scope: room,
      document: 'page:stable:en',
      recoveryScope,
      recoveryKey: 'page-layout',
    });
    return null;
  }

  act(() => root.render(<ReconnectableEditor room={{ connection: 1 }} write={originalWriter} />));
  act(() => editLayout({ layout: 'unsaved layout' }));
  act(() => root.render(<ReconnectableEditor room={{ connection: 2 }} write={vi.fn()} />));

  const storedBeforeAck = JSON.parse(
    window.sessionStorage.getItem(`geul:editor-save-recovery:v1:${encodeURIComponent(recoveryScope)}`) ?? 'null',
  );
  expect(
    storedBeforeAck.entries.filter(
      (entry: { recoveryKey?: string; patch?: { layout?: string } }) =>
        entry.recoveryKey === 'page-layout' && entry.patch?.layout === 'unsaved layout',
    ),
  ).toHaveLength(2);

  const replacementWriter = vi.fn();
  act(() => root.render(<ReconnectableEditor room={{ connection: 3 }} write={replacementWriter} />));
  await act(async () => vi.advanceTimersByTimeAsync(500));
  expect(originalWriter).not.toHaveBeenCalled();
  expect(replacementWriter).toHaveBeenCalledExactlyOnceWith({ layout: 'unsaved layout' });
  expect(readEditorSaveRecovery(recoveryScope)).toBeNull();
});

it('restores only the exact inactive scope, document, and recovery key', async () => {
  const recoveryScope = 'map-room:one:en';
  const otherScope = 'map-room:other:en';
  const documentKey = 'map:one:en';
  window.sessionStorage.clear();
  const stored = (scope: string, id: string, document: string, patch: object, recoveryKey?: string) =>
    persistEditorSaveRecoveryEntry(scope, id, {
      document,
      updatedAt: Date.now(),
      patch,
      ...(recoveryKey === undefined ? {} : { recoveryKey }),
    });

  activateEditorSaveRecoveryQueue('active-map-queue');
  stored(recoveryScope, 'active-map-queue', documentKey, { title: 'must not steal active' }, 'map-metadata');
  stored(recoveryScope, 'wrong-key', documentKey, { title: 'wrong writer' }, 'map-layout');
  stored(recoveryScope, 'wrong-document', 'map:other:en', { title: 'wrong locale' }, 'map-metadata');
  stored(recoveryScope, 'legacy-unkeyed', documentKey, { title: 'unknown writer' });
  stored(otherScope, 'wrong-scope', documentKey, { title: 'wrong room' }, 'map-metadata');
  stored(recoveryScope, 'recoverable-map-queue', documentKey, { title: 'right writer' }, 'map-metadata');

  const currentWriter = vi.fn();
  function RecoverableEditor() {
    edit = useDebouncedPatch({
      write: currentWriter,
      delay: 500,
      scope: 'map-room:one',
      document: documentKey,
      recoveryScope,
      recoveryKey: 'map-metadata',
    });
    return null;
  }

  try {
    act(() => root.render(<RecoverableEditor />));
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(currentWriter).toHaveBeenCalledExactlyOnceWith({ title: 'right writer' });
    expect(
      readEditorSaveRecovery(recoveryScope)
        ?.entries.map(({ id }) => id)
        .sort(),
    ).toEqual(['legacy-unkeyed', 'wrong-document', 'wrong-key'].sort());
    expect(readEditorSaveRecovery(otherScope)?.entries).toMatchObject([
      { id: 'wrong-scope', patch: { title: 'wrong room' } },
    ]);
  } finally {
    deactivateEditorSaveRecoveryQueue('active-map-queue');
    clearEditorSaveRecovery(recoveryScope);
    clearEditorSaveRecovery(otherScope);
  }
});

it('preserves unknown recovery entry shapes without replaying them', async () => {
  const recoveryScope = 'client-room:legacy:en';
  const documentKey = 'client:legacy:en';
  const storageKey = `geul:editor-save-recovery:v1:${encodeURIComponent(recoveryScope)}`;
  const unknownEntry = { document: documentKey, patch: { title: 'untyped legacy' }, futureVersion: 2 };
  window.sessionStorage.setItem(
    storageKey,
    JSON.stringify({
      version: 1,
      scope: recoveryScope,
      entries: [
        unknownEntry,
        {
          queueId: 'known-keyed-recovery',
          document: documentKey,
          updatedAt: 1,
          recoveryKey: 'client-metadata',
          patch: { title: 'known recovery' },
        },
      ],
    }),
  );
  const currentWriter = vi.fn();
  function RecoverableEditor() {
    edit = useDebouncedPatch({
      write: currentWriter,
      delay: 500,
      scope: 'client-room:legacy',
      document: documentKey,
      recoveryScope,
      recoveryKey: 'client-metadata',
    });
    return null;
  }

  act(() => root.render(<RecoverableEditor />));
  await act(async () => vi.advanceTimersByTimeAsync(500));

  expect(currentWriter).toHaveBeenCalledExactlyOnceWith({ title: 'known recovery' });
  const storedAfterAck = JSON.parse(window.sessionStorage.getItem(storageKey) ?? 'null');
  expect(storedAfterAck.entries).toEqual([unknownEntry]);
});

it('merges archived keyed batches in observation order through the current writer', async () => {
  const recoveryScope = 'page-room:merge:en';
  const documentKey = 'page:merge:en';
  window.sessionStorage.clear();
  persistEditorSaveRecoveryEntry(recoveryScope, 'early-queue', {
    document: documentKey,
    updatedAt: 10,
    recoveryKey: 'page-metadata',
    patch: { observed: 'initial', desired: 'first' },
  });
  persistEditorSaveRecoveryEntry(recoveryScope, 'late-queue', {
    document: documentKey,
    updatedAt: 20,
    recoveryKey: 'page-metadata',
    patch: { observed: 'peer value', desired: 'latest' },
  });
  const merge = vi.fn(
    (pending: { observed: string; desired: string }, next: { observed: string; desired: string }) => ({
      observed: pending.observed,
      desired: next.desired,
    }),
  );
  const currentWriter = vi.fn();
  function HookOwner() {
    useDebouncedPatch<{ observed: string; desired: string }>({
      write: currentWriter,
      delay: 500,
      scope: 'page-room:merge',
      document: documentKey,
      recoveryScope,
      recoveryKey: 'page-metadata',
      merge,
    });
    return null;
  }

  act(() => root.render(<HookOwner />));
  await act(async () => vi.advanceTimersByTimeAsync(500));

  expect(merge).toHaveBeenCalledWith(
    { observed: 'initial', desired: 'first' },
    { observed: 'peer value', desired: 'latest' },
  );
  expect(currentWriter).toHaveBeenCalledExactlyOnceWith({ observed: 'initial', desired: 'latest' });
});

it('restores the same queue ID after a StrictMode-style cancelled effect cleanup', async () => {
  const recoveryScope = 'post-room:strict:en';
  const queue = createDebouncedPatch<{ title: string }>(
    500,
    'post:strict:en',
    recoveryScope,
    undefined,
    true,
    'post-metadata',
  );
  const writer = vi.fn();
  queue.enqueue({ title: 'cancelled by cleanup' }, writer);
  queue.preservePendingForRecovery();
  queue.cancel();
  queue.deactivateRecovery();

  queue.activateRecovery(writer);
  await vi.advanceTimersByTimeAsync(500);

  expect(writer).toHaveBeenCalledExactlyOnceWith({ title: 'cancelled by cleanup' });
  expect(readEditorSaveRecovery(recoveryScope)).toBeNull();
  queue.deactivateRecovery();
});

it('automatically resumes memory-fallback recovery when session storage writes fail', async () => {
  const recoveryScope = 'artist-room:memory:en';
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage quota exceeded');
  });
  const initialWriter = vi.fn();
  function RecoverableEditor({ write }: { write: (patch: object) => void }) {
    edit = useDebouncedPatch({
      write,
      delay: 500,
      scope: 'artist-room:memory',
      document: 'artist:memory:en',
      recoveryScope,
      recoveryKey: 'artist-metadata',
    });
    return null;
  }

  try {
    act(() => root.render(<RecoverableEditor write={initialWriter} />));
    act(() => edit({ title: 'memory backed' }));
    act(() => root.unmount());

    const restoredWriter = vi.fn();
    root = createRoot(host);
    act(() => root.render(<RecoverableEditor write={restoredWriter} />));
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(restoredWriter).toHaveBeenCalledExactlyOnceWith({ title: 'memory backed' });
    expect(readEditorSaveRecovery(recoveryScope)).toBeNull();
  } finally {
    setItem.mockRestore();
  }
});
