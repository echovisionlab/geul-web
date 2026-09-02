// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchRouteProgressStart } from '@/lib/navigation/route-progress-events';
import {
  routeProgressStore,
  ROUTE_PROGRESS_COMPLETION_MS,
  ROUTE_PROGRESS_REVEAL_DELAY_MS,
} from '@/lib/navigation/route-progress-store';
import { RouteProgressRuntime } from './RouteProgressRuntime';

let pathname = '/';
let renderedSearch = '';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(renderedSearch),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  routeProgressStore.reset();
  pathname = '/';
  renderedSearch = '';
  window.history.replaceState({}, '', '/');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  routeProgressStore.reset();
  container.remove();
  vi.useRealTimers();
});

describe('RouteProgressRuntime', () => {
  it('connects router-start events to the committed route without patching navigation APIs', () => {
    act(() => root.render(<RouteProgressRuntime />));

    act(() => dispatchRouteProgressStart('/posts?lang=ko'));
    expect(container.querySelector('[data-route-progress]')?.getAttribute('data-phase')).toBe('waiting');

    act(() => vi.advanceTimersByTime(ROUTE_PROGRESS_REVEAL_DELAY_MS));
    expect(container.querySelector('[data-route-progress]')?.getAttribute('data-phase')).toBe('loading');

    pathname = '/posts';
    renderedSearch = 'lang=ko';
    act(() => root.render(<RouteProgressRuntime />));
    expect(container.querySelector('[data-route-progress]')?.getAttribute('data-phase')).toBe('completing');

    act(() => vi.advanceTimersByTime(ROUTE_PROGRESS_COMPLETION_MS));
    expect(container.querySelector('[data-route-progress]')?.getAttribute('data-phase')).toBe('idle');
  });
});
