// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { FloatingPanel } from './FloatingPanel';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
describe('FloatingPanel viewport behavior', () => {
  it('keeps tools inside the usable viewport when a scrollbar consumes inline space', () => {
    const width = vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(375);
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 350,
      height: 200,
      top: 0,
      left: 0,
      right: 350,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
      act(() =>
        root.render(
          <FloatingPanel label="Assistant" initialPosition={{ top: 120, left: 20 }} dragHandleSelector="button">
            <button type="button">Move</button>
          </FloatingPanel>,
        ),
      );
      const panel = host.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(panel.style.left).toBe('17px');
    } finally {
      act(() => root.unmount());
      host.remove();
      width.mockRestore();
      bounds.mockRestore();
    }
  });
  it('clamps authored position and ignores external styles and reserved markers', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <FloatingPanel
          {...({ style: { opacity: 0.1 } } as {})}
          label="Assistant"
          initialPosition={{ top: -40, left: -20 }}
          dragHandleSelector="[data-handle]"
        >
          <header data-handle>Move</header>
          <button type="button">Action</button>
        </FloatingPanel>,
      ),
    );
    const panel = host.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(panel.style.top).toBe('8px');
    expect(panel.style.left).toBe('8px');
    expect(panel.style.opacity).toBe('');
    act(() => root.unmount());
    host.remove();
  });
});

it('moves only a focused drag handle with arrows and clamps keyboard movement', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <FloatingPanel
          label="Assistant"
          initialPosition={{ top: 20, left: 20 }}
          dragHandleSelector="[data-handle]"
          excludeDragHandleSelector="input"
        >
          <header data-handle>
            <button type="button" data-interaction="drag-handle">
              Move
            </button>
            <input aria-label="Prompt" />
          </header>
        </FloatingPanel>,
      ),
    );
    const panel = host.querySelector<HTMLElement>('[role="dialog"]')!;
    const handle = host.querySelector('button')!;
    act(() =>
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })),
    );
    expect(panel.style.left).toBe('30px');
    act(() =>
      handle.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true, cancelable: true }),
      ),
    );
    expect(panel.style.top).toBe('8px');
    act(() =>
      host.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
    );
    expect(panel.style.left).toBe('30px');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
