// @vitest-environment jsdom

import { act, createRef, type ReactNode, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorMediaBlockFrame } from '../ui/EditorMediaBlockShell';
import { useBlockResize } from './useBlockResize';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ResizeHarness({
  enabled = true,
  keyboardSession,
  onResize,
  previewWidth = '60',
  sessionBlock,
}: {
  enabled?: boolean;
  keyboardSession?: { owner: object; key: string };
  onResize: (width: number) => void;
  previewWidth?: string;
  sessionBlock?: { id: string; type: string };
}) {
  const containerRef = createRef<HTMLDivElement>();
  const controls = useBlockResize({ containerRef, previewWidth, enabled, onResize, keyboardSession });
  const frame = (
    <EditorMediaBlockFrame
      containerRef={containerRef}
      widthPercent={controls.widthPercent}
      allowResize={enabled}
      resizeLeftLabel="너비 줄이기"
      resizeRightLabel="너비 늘리기"
      onResizeLeftPointerDown={controls.startResizeLeft}
      onResizeRightPointerDown={controls.startResizeRight}
      onResizeLeftKeyDown={controls.onResizeKeyDown}
      onResizeRightKeyDown={controls.onResizeKeyDown}
      onResizeBlur={controls.onResizeBlur}
    >
      <div>media</div>
    </EditorMediaBlockFrame>
  );
  return sessionBlock ? (
    <div data-node-type="blockContainer" data-id={sessionBlock.id}>
      <div data-content-type={sessionBlock.type}>{frame}</div>
    </div>
  ) : (
    frame
  );
}

function NativeEditorKeymapBoundary({ children, onEscape }: { children: ReactNode; onEscape: () => void }) {
  const boundaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const boundary = boundaryRef.current;
    const stopEditorEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape();
        event.stopPropagation();
      }
    };
    boundary?.addEventListener('keydown', stopEditorEscape);
    return () => boundary?.removeEventListener('keydown', stopEditorEscape);
  }, [onEscape]);
  return <div ref={boundaryRef}>{children}</div>;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

describe('useBlockResize', () => {
  it('commits Arrow resize in five-percent steps and restores the keyboard session with Escape', () => {
    const onResize = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(<ResizeHarness onResize={onResize} />));

    const handle = container.querySelector<HTMLButtonElement>('[aria-label="너비 늘리기"]');
    expect(handle?.getAttribute('aria-valuenow')).toBe('60');

    act(() => handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(onResize).toHaveBeenLastCalledWith(65);
    expect(handle?.getAttribute('aria-valuenow')).toBe('65');

    act(() => handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onResize).toHaveBeenLastCalledWith(60);
  });

  it('restores the keyboard session after the resize consumer remounts', () => {
    const onResize = vi.fn();
    const keyboardSessionKey = 'p5Sketch:block-1';
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() =>
      root?.render(
        <ResizeHarness
          key="before-transaction"
          keyboardSession={{ owner: {}, key: keyboardSessionKey }}
          onResize={onResize}
        />,
      ),
    );

    const initialHandle = container.querySelector<HTMLButtonElement>('[aria-label="너비 늘리기"]');
    initialHandle?.focus();
    act(() => initialHandle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(onResize).toHaveBeenLastCalledWith(65);

    act(() => {
      initialHandle?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      root?.render(
        <ResizeHarness
          key="after-transaction"
          keyboardSession={{ owner: {}, key: keyboardSessionKey }}
          onResize={onResize}
          previewWidth="65"
        />,
      );
    });
    const replacementHandle = container.querySelector<HTMLButtonElement>('[aria-label="너비 늘리기"]');
    expect(replacementHandle?.getAttribute('aria-valuenow')).toBe('65');

    act(() => replacementHandle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onResize).toHaveBeenLastCalledWith(60);
  });

  it('handles Escape before an editor keymap can consume the event', () => {
    const onEditorEscape = vi.fn();
    const onResize = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() =>
      root?.render(
        <NativeEditorKeymapBoundary onEscape={onEditorEscape}>
          <ResizeHarness onResize={onResize} />
        </NativeEditorKeymapBoundary>,
      ),
    );

    const handle = container.querySelector<HTMLButtonElement>('[aria-label="너비 늘리기"]');
    act(() => handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(onResize).toHaveBeenLastCalledWith(65);

    act(() => handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onResize).toHaveBeenLastCalledWith(60);
    expect(onEditorEscape).not.toHaveBeenCalled();
  });

  it('starts a new keyboard session after an intentional blur', async () => {
    const onResize = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(<ResizeHarness keyboardSession={{ owner: {}, key: 'map:block-1' }} onResize={onResize} />));

    const handle = container.querySelector<HTMLButtonElement>('[aria-label="너비 늘리기"]');
    handle?.focus();
    act(() => handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(onResize).toHaveBeenLastCalledWith(65);

    act(() => handle?.blur());
    await act(async () => Promise.resolve());
    handle?.focus();
    act(() => handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    expect(onResize).toHaveBeenLastCalledWith(10);

    act(() => handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onResize).toHaveBeenLastCalledWith(65);
  });

  it('derives a stable block session across a Map NodeView replacement', () => {
    const onResize = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() =>
      root?.render(
        <ResizeHarness key="before-map-transaction" sessionBlock={{ id: 'map-1', type: 'map' }} onResize={onResize} />,
      ),
    );

    const initialHandle = container.querySelector<HTMLButtonElement>('[aria-label="너비 늘리기"]');
    initialHandle?.focus();
    act(() => initialHandle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(onResize).toHaveBeenLastCalledWith(65);

    act(() => {
      initialHandle?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      root?.render(
        <ResizeHarness
          key="after-map-transaction"
          sessionBlock={{ id: 'map-1', type: 'map' }}
          onResize={onResize}
          previewWidth="65"
        />,
      );
    });
    const replacementHandle = container.querySelector<HTMLButtonElement>('[aria-label="너비 늘리기"]');
    act(() => replacementHandle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onResize).toHaveBeenLastCalledWith(60);
  });

  it('cancels an active pointer resize when authoring is revoked before pointerup', () => {
    const onResize = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(<ResizeHarness onResize={onResize} />));
    const frame = container.querySelector<HTMLElement>('[data-selected], [data-resizing], [style]');
    const editorSurface = frame?.parentElement;
    if (!editorSurface) {
      throw new Error('Resize harness editor surface is missing.');
    }
    Object.defineProperty(editorSurface, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 600, height: 100, top: 0, right: 600, bottom: 100, left: 0, x: 0, y: 0, toJSON() {} }),
    });
    const handle = container.querySelector<HTMLButtonElement>('[aria-label="너비 늘리기"]');
    const pointerDown = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 100 });
    Object.defineProperty(pointerDown, 'pointerId', { value: 7 });
    act(() => handle?.dispatchEvent(pointerDown));

    act(() => root?.render(<ResizeHarness enabled={false} onResize={onResize} />));
    const pointerUp = new MouseEvent('pointerup', { bubbles: true, clientX: 200 });
    Object.defineProperty(pointerUp, 'pointerId', { value: 7 });
    act(() => document.dispatchEvent(pointerUp));

    expect(onResize).not.toHaveBeenCalled();
    expect(container.querySelector('[data-resize-drag-shield]')).toBeNull();
    expect(container.querySelector('[data-resize-handle]')).toBeNull();
  });
});
