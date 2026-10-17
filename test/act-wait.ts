import { act } from 'react';
import { vi } from 'vitest';

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
