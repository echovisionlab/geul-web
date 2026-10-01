// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDebouncedPatch } from './useDebouncedPatch';
import { clearEditorSaveRecovery } from './editor-save-recovery';
import { flushAllEditorSaves } from './editor-save-registry';
import { usePendingEditorUnload } from './usePendingEditorUnload';

type EditorPatch = { title?: string };
type PatchWriter = (patch: EditorPatch) => Promise<void>;
const documentKeys = ['post:one', 'page:two'];
const edits = new Map<string, ReturnType<typeof useDebouncedPatch<EditorPatch>>>();

let root: Root;
let host: HTMLDivElement;

function PendingEditor({ document, write }: { document: string; write?: PatchWriter }) {
  const edit = useDebouncedPatch<EditorPatch>({
    write: write ?? (async () => undefined),
    delay: 500,
    scope: document,
    document,
    recoveryScope: null,
  });
  edits.set(document, edit);
  return null;
}

function Harness({ documents, writers }: { documents: string[]; writers?: Partial<Record<string, PatchWriter>> }) {
  usePendingEditorUnload();
  return documents.map((document) => <PendingEditor key={document} document={document} write={writers?.[document]} />);
}

function fireBeforeUnload() {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  edits.clear();
  host = document.createElement('div');
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  documentKeys.forEach((document) => clearEditorSaveRecovery(document));
  window.sessionStorage.clear();
  vi.useRealTimers();
});

it('warns for pending saves from any registered document and stops after acknowledgement', async () => {
  act(() => root.render(<Harness documents={documentKeys} />));
  act(() => {
    edits.get('post:one')?.({ title: 'post draft' });
    edits.get('page:two')?.({ title: 'page draft' });
  });

  expect(fireBeforeUnload().defaultPrevented).toBe(true);
  await act(async () => {
    expect(await flushAllEditorSaves()).toBe(true);
  });
  expect(fireBeforeUnload().defaultPrevented).toBe(false);
});

it('removes the warning when the last pending editor unmounts', () => {
  act(() => root.render(<Harness documents={['post:one']} />));
  act(() => edits.get('post:one')?.({ title: 'post draft' }));
  expect(fireBeforeUnload().defaultPrevented).toBe(true);

  act(() => root.render(<Harness documents={[]} />));
  expect(fireBeforeUnload().defaultPrevented).toBe(false);
});

it('keeps the warning active between debounce expiry and writer acknowledgement', async () => {
  let acknowledge!: () => void;
  const write = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        acknowledge = resolve;
      }),
  );

  act(() => root.render(<Harness documents={['post:one']} writers={{ 'post:one': write }} />));
  act(() => edits.get('post:one')?.({ title: 'pending title' }));

  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });

  expect(write).toHaveBeenCalledOnce();
  expect(fireBeforeUnload().defaultPrevented).toBe(true);

  await act(async () => {
    acknowledge();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(fireBeforeUnload().defaultPrevented).toBe(false);
});
