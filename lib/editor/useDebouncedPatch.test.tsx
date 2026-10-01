// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDebouncedPatch } from './useDebouncedPatch';
import { flushAllEditorSaves, flushEditorSaves } from './editor-save-registry';
import { clearEditorSaveRecovery, exportEditorSaveRecoveries, readEditorSaveRecovery } from './editor-save-recovery';

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
  await expect(flushAllEditorSaves(documentKey)).resolves.toBe(false);

  const currentWriter = vi.fn();
  root = createRoot(host);
  act(() => root.render(<RecoverableEditor write={currentWriter} />));
  act(() => edit({ summary: 'new room edit' }));
  await act(async () => {
    await expect(flushAllEditorSaves(documentKey)).resolves.toBe(false);
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

it('keeps an exportable in-memory recovery copy when session storage rejects writes', () => {
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
  expect(exportEditorSaveRecoveries('artist:one')).toContain('memory fallback');
  clearEditorSaveRecovery(recoveryScope);
});
