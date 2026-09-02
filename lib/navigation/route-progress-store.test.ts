// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRouteProgressStore,
  ROUTE_PROGRESS_COMPLETION_MS,
  ROUTE_PROGRESS_REVEAL_DELAY_MS,
  ROUTE_PROGRESS_SAFETY_TIMEOUT_MS,
} from './route-progress-store';

describe('routeProgressStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ignores same-document and hash-only navigation', () => {
    const store = createRouteProgressStore();

    expect(store.start('/posts?lang=en', 'https://www.example.invalid/posts?lang=en')).toBe(false);
    expect(store.start('/posts?lang=en#comments', 'https://www.example.invalid/posts?lang=en')).toBe(false);
    expect(store.getSnapshot().phase).toBe('idle');
  });

  it('ignores invalid and cross-origin navigation', () => {
    const store = createRouteProgressStore();

    expect(store.start('https://example.com/posts', 'https://www.example.invalid/')).toBe(false);
    expect(store.start('/posts', 'not a URL')).toBe(false);
  });

  it('does not flash for navigation completed before the reveal delay', () => {
    const store = createRouteProgressStore();
    const phases: string[] = [];
    store.subscribe(() => phases.push(store.getSnapshot().phase));

    expect(store.start('/posts', 'https://www.example.invalid/')).toBe(true);
    expect(store.getSnapshot().phase).toBe('waiting');
    store.complete();
    vi.advanceTimersByTime(ROUTE_PROGRESS_REVEAL_DELAY_MS);

    expect(store.getSnapshot().phase).toBe('idle');
    expect(phases).toEqual(['waiting', 'idle']);
  });

  it('reveals, completes, and removes a visible route progress bar', () => {
    const store = createRouteProgressStore();

    store.start('/posts', 'https://www.example.invalid/');
    vi.advanceTimersByTime(ROUTE_PROGRESS_REVEAL_DELAY_MS);
    expect(store.getSnapshot().phase).toBe('loading');

    store.complete();
    expect(store.getSnapshot().phase).toBe('completing');
    vi.advanceTimersByTime(ROUTE_PROGRESS_COMPLETION_MS);
    expect(store.getSnapshot().phase).toBe('idle');
  });

  it('keeps an already visible bar active across interrupted navigation', () => {
    const store = createRouteProgressStore();

    store.start('/posts', 'https://www.example.invalid/');
    vi.advanceTimersByTime(ROUTE_PROGRESS_REVEAL_DELAY_MS);
    store.start('/works', 'https://www.example.invalid/');

    expect(store.getSnapshot().phase).toBe('loading');
  });

  it('fails safe instead of leaving the bar stuck forever', () => {
    const store = createRouteProgressStore();

    store.start('/posts', 'https://www.example.invalid/');
    vi.advanceTimersByTime(ROUTE_PROGRESS_SAFETY_TIMEOUT_MS);
    expect(store.getSnapshot().phase).toBe('completing');
    vi.advanceTimersByTime(ROUTE_PROGRESS_COMPLETION_MS);
    expect(store.getSnapshot().phase).toBe('idle');
  });
});
