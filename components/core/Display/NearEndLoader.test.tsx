// @vitest-environment jsdom

import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NearEndLoader, type NearEndLoaderProps } from './NearEndLoader';

const labels = {
  load: 'Continue',
  loading: 'Loading',
  end: 'End of results',
  retry: 'Try again',
  failed: 'Load failed',
};
let host: HTMLDivElement;
let root: Root;
let observers: TestIntersectionObserver[];

class TestIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null;
  readonly rootMargin: string;
  readonly scrollMargin = '0px';
  readonly thresholds = [0];
  target?: Element;
  disconnected = false;
  constructor(
    private callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.root = options?.root ?? null;
    this.rootMargin = options?.rootMargin ?? '0px';
    observers.push(this);
  }
  observe(target: Element) {
    this.target = target;
  }
  unobserve() {
    this.target = undefined;
  }
  disconnect() {
    this.disconnected = true;
  }
  takeRecords() {
    return [];
  }
  enter() {
    if (!this.target || this.disconnected) {
      return;
    }
    this.callback([{ isIntersecting: true, target: this.target } as IntersectionObserverEntry], this);
  }
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function render(options: Partial<NearEndLoaderProps>) {
  act(() =>
    root.render(
      <NearEndLoader pageKey="page-2" resetKey="query-a" labels={labels} onLoad={async () => {}} {...options} />,
    ),
  );
}
function enter() {
  act(() => observers.filter((observer) => !observer.disconnected).forEach((observer) => observer.enter()));
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('NearEndLoader', () => {
  it('uses the explicit scrolling root and requests each cursor once, without concurrent requests', async () => {
    const pending = deferred();
    const onLoad = vi.fn(() => pending.promise);
    const rootRef = createRef<HTMLElement>();
    rootRef.current = host;
    Object.defineProperties(host, { scrollHeight: { value: 300 }, clientHeight: { value: 100 } });
    render({ rootRef, onLoad });
    expect(observers.at(-1)?.root).toBe(host);
    expect(observers.at(-1)?.rootMargin).toBe('240px 0px');
    enter();
    enter();
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Loading');
    await act(async () => pending.resolve());
    enter();
    expect(onLoad).toHaveBeenCalledTimes(1);
    render({ rootRef, onLoad, pageKey: 'page-3' });
    enter();
    expect(onLoad).toHaveBeenCalledTimes(2);
  });

  it('stops automatic error retry loops and lets the same keyboard command retry', async () => {
    const pending = deferred();
    const onLoad = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockImplementationOnce(() => pending.promise);
    render({ onLoad });
    enter();
    await act(async () => {
      await Promise.resolve();
    });
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Load failed');
    enter();
    expect(onLoad).toHaveBeenCalledTimes(1);
    const retry = host.querySelector<HTMLButtonElement>('button')!;
    expect(retry.textContent).toBe('Try again');
    act(() => {
      retry.focus();
      retry.click();
    });
    expect(onLoad).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(retry);
    expect(retry.getAttribute('aria-disabled')).toBe('true');
    await act(async () => pending.resolve());
    expect(document.activeElement).toBe(retry);
    enter();
    expect(onLoad).toHaveBeenCalledTimes(2);
  });

  it('resets the attempt budget on a new query and ignores an old request completion', async () => {
    const old = deferred();
    const current = deferred();
    const onLoad = vi
      .fn()
      .mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(() => current.promise);
    render({ onLoad });
    enter();
    render({ onLoad, resetKey: 'query-b' });
    enter();
    expect(onLoad).toHaveBeenCalledTimes(2);
    await act(async () => old.resolve());
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Loading');
    await act(async () => current.resolve());
    render({ onLoad, resetKey: 'query-b', pageKey: null });
    enter();
    expect(host.querySelector('[role="status"]')?.textContent).toBe('End of results');
    expect(host.querySelector('button')).toBeNull();
    expect(onLoad).toHaveBeenCalledTimes(2);
  });

  it('provides a compact command when observation is unavailable and cleans up mounted observers', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const onLoad = vi.fn().mockResolvedValue(undefined);
    render({ onLoad });
    expect(host.querySelector('[data-automatic]')).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
    expect(onLoad).toHaveBeenCalledTimes(1);
    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
    render({ onLoad, pageKey: 'page-3' });
    const active = observers.at(-1)!;
    act(() => root.render(null));
    expect(active.disconnected).toBe(true);
  });

  it('finds the closest scroll owner and exposes the command if observer setup fails', () => {
    host.style.overflowY = 'auto';
    Object.defineProperties(host, { scrollHeight: { value: 300 }, clientHeight: { value: 100 } });
    render({});
    expect(observers.at(-1)?.root).toBe(host);
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor() {
          throw new Error('Observer unavailable');
        }
      },
    );
    render({ pageKey: 'page-3' });
    expect(host.querySelector('[data-automatic]')).toBeNull();
    expect(host.querySelector('button')?.textContent).toBe('Continue');
  });

  it('keeps keyboard focus on the continuation command when the final page arrives', () => {
    render({});
    const command = host.querySelector<HTMLButtonElement>('button')!;
    act(() => command.focus());
    render({ pageKey: null });
    expect(document.activeElement).toBe(command);
    expect(command.getAttribute('aria-disabled')).toBe('true');
    const description = document.getElementById(command.getAttribute('aria-describedby')!);
    expect(description?.textContent).toBe('End of results');
    act(() => command.blur());
    expect(host.querySelector('button')).toBeNull();
  });
});
