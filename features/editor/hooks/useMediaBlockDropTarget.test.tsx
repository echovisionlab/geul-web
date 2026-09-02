// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorMediaIngestProvider } from '@/features/editor/contexts/EditorMediaIngestContext';
import { useMediaBlockDropTarget } from './useMediaBlockDropTarget';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let editorRoot: HTMLDivElement;
const dropFilesAtBlock = vi.fn(async () => true);

beforeEach(() => {
  container = document.createElement('div');
  editorRoot = document.createElement('div');
  document.body.append(container, editorRoot);
  root = createRoot(container);
  dropFilesAtBlock.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  editorRoot.remove();
});

function Probe({ enabled = true }: { enabled?: boolean }) {
  const { isDropActive, dropTargetProps } = useMediaBlockDropTarget({
    blockId: 'block-1',
    editor: { _tiptapEditor: { view: { dom: editorRoot } } },
    enabled,
  });
  return <div data-testid="drop-target" data-active={isDropActive} {...dropTargetProps} />;
}

function renderProbe(enabled = true) {
  act(() => {
    root.render(
      <EditorMediaIngestProvider dropFilesAtBlock={dropFilesAtBlock} selectLibraryFilesAtBlock={() => false}>
        <Probe enabled={enabled} />
      </EditorMediaIngestProvider>,
    );
  });
  return container.querySelector<HTMLElement>('[data-testid="drop-target"]')!;
}

function dispatchDrag(target: HTMLElement, type: string, files: File[] = [], relatedTarget: EventTarget | null = null) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    dataTransfer: {
      value: { files, items: [], types: files.length > 0 ? ['Files'] : [], dropEffect: 'none' },
    },
    relatedTarget: { value: relatedTarget },
  });
  act(() => target.dispatchEvent(event));
  return event;
}

describe('useMediaBlockDropTarget', () => {
  it('owns drag state, editor-root signalling, and the drop command', async () => {
    const target = renderProbe();
    const file = new File(['audio'], 'field.wav', { type: 'audio/wav' });

    const dragOver = dispatchDrag(target, 'dragover', [file]);
    expect(dragOver.defaultPrevented).toBe(true);
    expect(target.dataset.active).toBe('true');
    expect(editorRoot.getAttribute('data-media-drop-target-active')).toBe('true');

    dispatchDrag(target, 'drop', [file]);
    await act(async () => {
      await Promise.resolve();
    });

    expect(dropFilesAtBlock).toHaveBeenCalledWith('block-1', [file]);
    expect(target.dataset.active).toBe('false');
    expect(editorRoot.hasAttribute('data-media-drop-target-active')).toBe(false);
  });

  it('ignores non-file drags and disabled targets', () => {
    let target = renderProbe();
    expect(dispatchDrag(target, 'dragover').defaultPrevented).toBe(false);
    expect(target.dataset.active).toBe('false');

    target = renderProbe(false);
    const file = new File(['audio'], 'field.wav', { type: 'audio/wav' });
    expect(dispatchDrag(target, 'dragover', [file]).defaultPrevented).toBe(false);
    expect(dropFilesAtBlock).not.toHaveBeenCalled();
  });

  it('keeps the target active while moving within it and clears it on exit', () => {
    const target = renderProbe();
    const child = document.createElement('span');
    target.appendChild(child);
    const file = new File(['audio'], 'field.wav', { type: 'audio/wav' });

    dispatchDrag(target, 'dragover', [file]);
    dispatchDrag(target, 'dragleave', [file], child);
    expect(target.dataset.active).toBe('true');

    dispatchDrag(target, 'dragleave', [file]);
    expect(target.dataset.active).toBe('false');
    expect(editorRoot.hasAttribute('data-media-drop-target-active')).toBe(false);
  });
});
