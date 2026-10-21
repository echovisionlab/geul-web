// @vitest-environment jsdom

import { act, createRef, type ReactNode, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorMediaBlockFrame } from '../ui/EditorMediaBlockShell';
import { useBlockResize } from './useBlockResize';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ResizeHarness({
  enabled = true,
  keyboardSession,
  onResize,
  displaySize = '60',
  sessionBlock,
  aspectRatio,
}: {
  enabled?: boolean;
  keyboardSession?: { owner: object; key: string };
  onResize: (width: number) => void;
  displaySize?: string;
  sessionBlock?: { id: string; type: string };
  aspectRatio?: number;
}) {
  const containerRef = createRef<HTMLDivElement>();
  const controls = useBlockResize({ containerRef, displaySize, enabled, onResize, keyboardSession, aspectRatio });
  const frame = (
    <EditorMediaBlockFrame
      containerRef={containerRef}
      displaySize={controls.widthPercent}
      aspectRatio={aspectRatio}
      allowResize={enabled}
      resizeLeftLabel="너비 줄이기"
      resizeRightLabel="너비 늘리기"
      onResizeLeftPointerDown={controls.startResizeLeft}
      onResizeRightPointerDown={controls.startResizeRight}
      onResizeTopPointerDown={controls.startResizeTop}
      onResizeBottomPointerDown={controls.startResizeBottom}
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

/** Presses a key and lets the keyboard steps settle, which is when the size is saved. */
function press(target: HTMLElement | null | undefined, key: string) {
  act(() => {
    target?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    vi.advanceTimersByTime(300);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
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

    press(handle, 'ArrowRight');
    expect(onResize).toHaveBeenLastCalledWith(65);
    expect(handle?.getAttribute('aria-valuenow')).toBe('65');

    press(handle, 'Escape');
    expect(onResize).toHaveBeenLastCalledWith(60);
  });

  it('shows each keyboard step at once and saves only the settled size', () => {
    const onResize = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(<ResizeHarness onResize={onResize} />));
    const handle = container.querySelector<HTMLButtonElement>('[aria-label="너비 늘리기"]');

    act(() => handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    act(() => handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(handle?.getAttribute('aria-valuenow')).toBe('70');
    expect(onResize).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));
    expect(onResize).toHaveBeenCalledTimes(1);
    expect(onResize).toHaveBeenLastCalledWith(70);
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
    press(initialHandle, 'ArrowRight');
    expect(onResize).toHaveBeenLastCalledWith(65);

    act(() => {
      initialHandle?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      root?.render(
        <ResizeHarness
          key="after-transaction"
          keyboardSession={{ owner: {}, key: keyboardSessionKey }}
          onResize={onResize}
          displaySize="65"
        />,
      );
    });
    const replacementHandle = container.querySelector<HTMLButtonElement>('[aria-label="너비 늘리기"]');
    expect(replacementHandle?.getAttribute('aria-valuenow')).toBe('65');

    press(replacementHandle, 'Escape');
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
    press(handle, 'ArrowRight');
    expect(onResize).toHaveBeenLastCalledWith(65);

    press(handle, 'Escape');
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
    press(handle, 'ArrowRight');
    expect(onResize).toHaveBeenLastCalledWith(65);

    act(() => handle?.blur());
    await act(async () => Promise.resolve());
    handle?.focus();
    press(handle, 'Home');
    expect(onResize).toHaveBeenLastCalledWith(10);

    press(handle, 'Escape');
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
    press(initialHandle, 'ArrowRight');
    expect(onResize).toHaveBeenLastCalledWith(65);

    act(() => {
      initialHandle?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      root?.render(
        <ResizeHarness
          key="after-map-transaction"
          sessionBlock={{ id: 'map-1', type: 'map' }}
          onResize={onResize}
          displaySize="65"
        />,
      );
    });
    const replacementHandle = container.querySelector<HTMLButtonElement>('[aria-label="너비 늘리기"]');
    press(replacementHandle, 'Escape');
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

  it('resizes a block with an aspect ratio from its bottom edge and snaps near a preset', () => {
    const onResize = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(<ResizeHarness onResize={onResize} aspectRatio={1} />));
    const frame = container.querySelector<HTMLElement>('[data-resize-handle]')?.parentElement;
    // At size 60 the square frame is 360px wide, so size 100 is 600px.
    Object.defineProperty(frame, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 360 }) });
    const drag = (direction: string, from: { x: number; y: number }, to: { x: number; y: number }) => {
      const handle = container?.querySelector<HTMLButtonElement>(`[data-resize-direction="${direction}"]`);
      const down = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: from.x, clientY: from.y });
      Object.defineProperty(down, 'pointerId', { value: 3 });
      act(() => handle?.dispatchEvent(down));
      for (const type of ['pointermove', 'pointerup']) {
        const event = new MouseEvent(type, { bubbles: true, clientX: to.x, clientY: to.y });
        Object.defineProperty(event, 'pointerId', { value: 3 });
        act(() => document.dispatchEvent(event));
      }
    };

    drag('bottom', { x: 0, y: 0 }, { x: 0, y: 60 });
    expect(onResize).toHaveBeenLastCalledWith(70);

    // The draft now shows 70 until the stored size catches up; drag again from there.
    Object.defineProperty(frame, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 420 }) });
    drag('top', { x: 0, y: 0 }, { x: 0, y: -55 });
    expect(onResize).toHaveBeenLastCalledWith(80);
  });
});
