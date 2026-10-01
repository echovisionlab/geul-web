// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import { flushEditorSaves } from '@/lib/editor/editor-save-registry';
import { readEditorSaveRecovery } from '@/lib/editor/editor-save-recovery';
import type { PostConfigPatch } from './post-config-save';
import { usePostConfigSave } from './usePostConfigSave';

const mocks = vi.hoisted(() => ({ updatePostAction: vi.fn() }));
vi.mock('@/lib/actions/post', () => ({ updatePostAction: mocks.updatePostAction }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

const postId = '11111111-1111-4111-8111-111111111111';
let root: Root;
let container: HTMLDivElement;
let update: ReturnType<typeof usePostConfigSave>;
let queryClient: QueryClient;

function Harness() {
  update = usePostConfigSave(postId);
  return null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function settlePromises() {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  queryClient.clear();
  container.remove();
  window.sessionStorage.clear();
  vi.useRealTimers();
});

describe('Post config saves', () => {
  it('waits for A acknowledgement before sending the latest same-field value B', async () => {
    const requests: Array<{ patch: PostConfigPatch; response: ReturnType<typeof deferred<{ ok: boolean }>> }> = [];
    mocks.updatePostAction.mockImplementation((_postId: string, patch: PostConfigPatch) => {
      const response = deferred<{ ok: boolean }>();
      requests.push({ patch, response });
      return response.promise;
    });

    act(() => update({ commentsEnabled: false }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(requests.map(({ patch }) => patch)).toEqual([{ commentsEnabled: false }]);

    act(() => update({ commentsEnabled: true }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(requests).toHaveLength(1);

    await act(async () => {
      requests[0].response.resolve({ ok: true });
      await settlePromises();
    });
    expect(requests.map(({ patch }) => patch)).toEqual([{ commentsEnabled: false }, { commentsEnabled: true }]);

    await act(async () => {
      requests[1].response.resolve({ ok: true });
      await settlePromises();
    });
  });

  it('rejects failed ActionResults and keeps the config patch retryable through the save registry', async () => {
    mocks.updatePostAction
      .mockResolvedValueOnce({ ok: false, error: 'permission denied', errorCode: 'POST_UPDATE_FAILED' })
      .mockResolvedValueOnce({ ok: true, success: true });
    act(() => update({ documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' } }));

    let firstFlush = true;
    await act(async () => {
      firstFlush = await flushEditorSaves(`post:${postId}`);
    });
    expect(firstFlush).toBe(false);
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'permission denied', color: 'red' }),
    );
    expect(mocks.updatePostAction).toHaveBeenCalledOnce();

    let retryFlush = false;
    await act(async () => {
      retryFlush = await flushEditorSaves(`post:${postId}`);
    });
    expect(retryFlush).toBe(true);
    expect(mocks.updatePostAction).toHaveBeenCalledTimes(2);
    expect(mocks.updatePostAction).toHaveBeenNthCalledWith(1, postId, {
      documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' },
    });
    expect(mocks.updatePostAction).toHaveBeenNthCalledWith(2, postId, {
      documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' },
    });
  });

  it('flushes map-place changes through the same queue as pending comments', async () => {
    mocks.updatePostAction.mockResolvedValue({ ok: true, success: true });
    act(() => update({ commentsEnabled: false }));
    act(() => update({ mapPlaceId: 'place-1' }));

    let flushed = false;
    await act(async () => {
      flushed = await update.flush();
    });

    expect(flushed).toBe(true);
    expect(mocks.updatePostAction).toHaveBeenCalledExactlyOnceWith(postId, {
      commentsEnabled: false,
      mapPlaceId: 'place-1',
    });
  });

  it('retains pending values under the Post configuration recovery scope after unmount', () => {
    act(() => update({ mapPlaceId: 'place-pending' }));
    act(() => root.unmount());
    root = createRoot(container);
    expect(readEditorSaveRecovery(`post:${postId}:configuration`)).toMatchObject({
      scope: `post:${postId}:configuration`,
      entries: [{ document: `post:${postId}`, patch: { mapPlaceId: 'place-pending' } }],
    });
    expect(readEditorSaveRecovery(`post:${postId}:other-locale`)).toBeNull();
  });
});
