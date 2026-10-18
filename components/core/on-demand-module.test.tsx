// @vitest-environment jsdom
import { act, renderHook } from '@/test/render';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { onDemandModule, useOnDemandModule } from './on-demand-module';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

type Restart = (rerender: (props: { request: string }) => void) => void;
it.each<[string, Restart]>([
  [
    'a new request arrives',
    (rerender) => {
      rerender({ request: 'second' });
    },
  ],
  [
    'the browser comes back online',
    () => {
      window.dispatchEvent(new Event('online'));
    },
  ],
])('stops retrying a failed load after a few attempts and loads again when %s', async (_, restart) => {
  const renderer = { name: 'renderer' };
  let failing = true;
  const loader = vi.fn(() =>
    failing ? Promise.reject(new Error('Failed to fetch dynamically imported module')) : Promise.resolve(renderer),
  );
  const module = onDemandModule(loader);
  const { result, rerender } = renderHook(({ request }) => useOnDemandModule(module, true, request), {
    initialProps: { request: 'first' },
  });
  await act(() => module.preload());
  expect(loader).toHaveBeenCalledOnce();
  for (const expectedAttempts of [2, 3, 4]) {
    await act(() => vi.advanceTimersToNextTimerAsync());
    expect(loader).toHaveBeenCalledTimes(expectedAttempts);
  }
  expect(result.current).toBeUndefined();
  await act(() => vi.advanceTimersByTimeAsync(30_000));
  expect(loader).toHaveBeenCalledTimes(4);

  failing = false;
  act(() => {
    restart(rerender);
  });
  expect(loader).toHaveBeenCalledTimes(5);
  // Joins the load the hook started; it does not start another.
  await act(() => module.preload());
  expect(loader).toHaveBeenCalledTimes(5);
  expect(result.current).toBe(renderer);
});
