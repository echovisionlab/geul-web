// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDebouncedPatch } from './useDebouncedPatch';
import { flushEditorSaves } from './editor-save-registry';

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
