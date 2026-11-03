// @vitest-environment jsdom
import { act, renderHook } from '@/test/render';
import { useLayoutEffect } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { onDemandModule, useOnDemandModule, useOnDemandModuleState } from './on-demand-module';

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

it('distinguishes terminal failure from pending backoff and explicitly retries the same request', async () => {
  const error = new Error('Chunk unavailable');
  const renderer = { name: 'renderer' };
  const recovery = Promise.withResolvers<typeof renderer>();
  const loader = vi.fn<() => Promise<typeof renderer>>(() => Promise.reject(error));
  const module = onDemandModule(loader);
  const { result } = renderHook(() => useOnDemandModuleState(module, true, 'same-request'));
  await act(() => module.preload());
  expect(result.current.status).toBe('pending');
  for (const delay of [500, 2000, 5000]) {
    await act(() => vi.advanceTimersByTimeAsync(delay));
  }
  expect(result.current.status).toBe('error');
  expect(result.current.error).toBe(error);
  expect(result.current.module).toBeUndefined();
  await act(() => vi.advanceTimersByTimeAsync(30_000));
  expect(loader).toHaveBeenCalledTimes(4);

  loader.mockImplementation(() => recovery.promise);
  act(() => result.current.retry());
  expect(result.current.status).toBe('pending');
  expect(result.current.error).toBeUndefined();
  expect(loader).toHaveBeenCalledTimes(5);
  await act(async () => {
    recovery.resolve(renderer);
    await module.preload();
  });
  expect(result.current.status).toBe('loaded');
  expect(result.current.module).toBe(renderer);
});

it.each(['changed request', 'cancel and reopen'] as const)(
  'commits pending immediately and grants a full retry round after %s',
  async (restart) => {
    const error = new Error('First request failed');
    const nextError = new Error('Fresh request failed');
    const loader = vi.fn(() => Promise.reject(error));
    const module = onDemandModule(loader);
    const commits: { status: string; error: unknown }[] = [];
    const { result, rerender } = renderHook(
      ({ needed, request }) => {
        const state = useOnDemandModuleState(module, needed, request);
        useLayoutEffect(() => {
          commits.push({ status: state.status, error: state.error });
        });
        return state;
      },
      { initialProps: { needed: true, request: 'first' } },
    );
    await act(async () => {
      await expect(module.load()).rejects.toBe(error);
    });
    for (const delay of [500, 2000, 5000]) {
      await act(() => vi.advanceTimersByTimeAsync(delay));
    }
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(error);
    expect(loader).toHaveBeenCalledTimes(4);

    if (restart === 'cancel and reopen') {
      rerender({ needed: false, request: 'first' });
      expect(result.current.status).toBe('idle');
      expect(result.current.error).toBeUndefined();
    }
    loader.mockImplementation(() => Promise.reject(nextError));
    commits.length = 0;
    rerender({ needed: true, request: restart === 'changed request' ? 'second' : 'first' });
    await act(() => module.preload());
    expect(commits.length).toBeGreaterThan(0);
    for (const commit of commits) {
      expect(commit).toEqual({ status: 'pending', error: undefined });
    }
    expect(loader).toHaveBeenCalledTimes(5);

    for (const [index, delay] of [500, 2000, 5000].entries()) {
      await act(() => vi.advanceTimersByTimeAsync(delay));
      expect(loader).toHaveBeenCalledTimes(6 + index);
      expect(result.current.status).toBe(index === 2 ? 'error' : 'pending');
    }
    expect(result.current.error).toBe(nextError);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(loader).toHaveBeenCalledTimes(8);
  },
);
