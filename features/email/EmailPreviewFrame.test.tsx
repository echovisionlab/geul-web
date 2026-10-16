// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi, type TestContext } from 'vitest';
import { EmailPreviewFrame } from './EmailPreviewFrame';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mountPreview(context: TestContext) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  const observers: PreviewResizeObserver[] = [];
  class PreviewResizeObserver implements ResizeObserver {
    observed = new Set<Element>();
    disconnect = vi.fn(() => this.observed.clear());
    constructor(private readonly callback: ResizeObserverCallback) {
      observers.push(this);
    }
    observe(target: Element) {
      this.observed.add(target);
    }
    unobserve(target: Element) {
      this.observed.delete(target);
    }
    notify() {
      this.callback([], this);
    }
  }
  vi.stubGlobal('ResizeObserver', PreviewResizeObserver);
  let mounted = true;
  const unmount = () => {
    if (!mounted) {
      return;
    }
    mounted = false;
    act(() => root.unmount());
    container.remove();
  };
  context.onTestFinished(() => {
    unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  return {
    render: (srcDoc: string | null) => {
      act(() => root.render(srcDoc === null ? null : <EmailPreviewFrame srcDoc={srcDoc} title="Email preview" />));
      return container.querySelector('iframe');
    },
    measure: () => {
      act(() => {
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) {
          callback(0);
        }
      });
    },
    observers,
    frames,
    unmount,
  };
}

function setDocumentHeight(frame: HTMLIFrameElement, height: () => number) {
  Object.defineProperty(frame.contentDocument!.documentElement, 'scrollHeight', {
    configurable: true,
    // A browser document's scroll height cannot be smaller than its viewport.
    get: () => Math.max(height(), Number.parseFloat(frame.style.height) || 0),
  });
}

describe('EmailPreviewFrame', () => {
  it('sizes a late-mounted preview without changing the delivered HTML or document styles', (context) => {
    const preview = mountPreview(context);
    expect(preview.render(null)).toBeNull();
    const html = '<!doctype html><html><body style="margin:24px"><p>Email</p></body></html>';
    const frame = preview.render(html)!;
    const body = frame.contentDocument!.body;
    body.innerHTML = '<p style="line-height:1.7">Delivered content</p>';
    const before = body.outerHTML;
    setDocumentHeight(frame, () => 720);
    preview.measure();

    expect(frame.style.height).toBe('720px');
    expect(frame.srcdoc).toBe(html);
    expect(body.outerHTML).toBe(before);
    expect(frame.getAttribute('scrolling')).toBe('no');
    expect(preview.observers.at(-1)?.observed.has(body)).toBe(true);
  });

  it('grows and shrinks as body geometry changes, coalescing resize notifications', (context) => {
    const preview = mountPreview(context);
    const frame = preview.render('<p>Preview</p>')!;
    let height = 840;
    setDocumentHeight(frame, () => height);
    preview.measure();
    expect(frame.style.height).toBe('840px');

    height = 1260;
    const observer = preview.observers.at(-1)!;
    observer.notify();
    observer.notify();
    expect(preview.frames.size).toBe(1);
    preview.measure();
    expect(frame.style.height).toBe('1260px');

    height = 260;
    observer.notify();
    preview.measure();
    expect(frame.style.height).toBe('260px');
  });

  it('rebinds to the loaded document and reacts to late image loading', (context) => {
    const preview = mountPreview(context);
    const frame = preview.render('<p>Preview</p>')!;
    const previous = preview.observers.at(-1)!;
    act(() => frame.dispatchEvent(new Event('load')));
    expect(previous.disconnect).toHaveBeenCalledOnce();
    const current = preview.observers.at(-1)!;
    expect(current).not.toBe(previous);
    let height = 400;
    setDocumentHeight(frame, () => height);
    preview.measure();
    expect(frame.style.height).toBe('400px');

    const image = frame.contentDocument!.createElement('img');
    frame.contentDocument!.body.append(image);
    height = 900;
    act(() => image.dispatchEvent(new Event('load')));
    preview.measure();
    expect(frame.style.height).toBe('900px');
    previous.notify();
    expect(preview.frames.size).toBe(0);
  });

  it('remeasures after fonts load and ignores their completion after unmount', async (context) => {
    const preview = mountPreview(context);
    const frame = preview.render('<p>Preview</p>')!;
    let finishFonts!: () => void;
    const fontReady = new Promise<void>((resolve) => {
      finishFonts = resolve;
    });
    Object.defineProperty(frame.contentDocument!, 'fonts', {
      configurable: true,
      value: { ready: fontReady },
    });
    act(() => frame.dispatchEvent(new Event('load')));
    let height = 400;
    setDocumentHeight(frame, () => height);
    preview.measure();
    expect(frame.style.height).toBe('400px');
    height = 650;
    await act(async () => finishFonts());
    preview.measure();
    expect(frame.style.height).toBe('650px');

    let finishLateFonts!: () => void;
    const lateFonts = new Promise<void>((resolve) => {
      finishLateFonts = resolve;
    });
    Object.defineProperty(frame.contentDocument!, 'fonts', {
      configurable: true,
      value: { ready: lateFonts },
    });
    act(() => frame.dispatchEvent(new Event('load')));
    preview.unmount();
    await act(async () => finishLateFonts());
    expect(preview.frames.size).toBe(0);
  });

  it('disconnects observers and cancels pending work on replacement and unmount', (context) => {
    const preview = mountPreview(context);
    const frame = preview.render('<p>First</p>')!;
    const first = preview.observers.at(-1)!;
    preview.render('<p>Second</p>');
    expect(first.disconnect).toHaveBeenCalledOnce();
    const second = preview.observers.at(-1)!;
    expect(preview.frames.size).toBe(1);
    preview.unmount();
    expect(second.disconnect).toHaveBeenCalledOnce();
    expect(preview.frames.size).toBe(0);
    first.notify();
    second.notify();
    frame.dispatchEvent(new Event('load'));
    expect(preview.frames.size).toBe(0);
  });
});
