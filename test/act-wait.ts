import { act } from 'react';
import { notifyManager } from '@tanstack/react-query';
import { afterEach, beforeEach, vi } from 'vitest';

/**
 * `vi.waitFor` for tests that render with `createRoot`: each poll first lets React commit inside `act`, so
 * async updates (queries, lazy chunks, debounces) never land outside it on a slow runner. The default
 * budget fits a full production page rendered by a loaded CI worker. Prefer Testing Library's `findBy*`
 * in tests that use `@/test/render`.
 */
export function waitInAct<T>(assertion: () => T | Promise<T>, timeout = 5000): Promise<T> {
  return vi.waitFor(
    async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      return assertion();
    },
    { timeout },
  );
}

/**
 * Wraps React Query's notifications in `act` for every test in the calling file, so a query that settles
 * between a test's last check and its cleanup does not update React outside `act`.
 */
export function wrapQueryNotificationsInAct(): void {
  beforeEach(() => {
    notifyManager.setNotifyFunction((callback) => {
      act(callback);
    });
  });
  afterEach(() => {
    notifyManager.setNotifyFunction((callback) => callback());
  });
}

/** Lets pending work (timers queued for the current tick, query results) commit inside `act` before cleanup. */
export async function settleInAct(): Promise<void> {
  await act(async () => {
    // Under fake timers a real macrotask never comes; flushing microtasks is all there is to settle.
    if (!vi.isFakeTimers()) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}
