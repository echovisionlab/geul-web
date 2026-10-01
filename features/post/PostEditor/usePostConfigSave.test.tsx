// @vitest-environment jsdom

import { Code } from '@connectrpc/connect';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import { flushEditorSaves } from '@/lib/editor/editor-save-registry';
import { clearEditorSaveRecovery, readEditorSaveRecovery } from '@/lib/editor/editor-save-recovery';
import type { PostConfigPatch } from './post-config-save';
import { usePostConfigSave } from './usePostConfigSave';

const mocks = vi.hoisted(() => ({ updatePostAction: vi.fn() }));
vi.mock('@/lib/actions/post', () => ({ updatePostAction: mocks.updatePostAction }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

const postId = '11111111-1111-4111-8111-111111111111';
const secondPostId = '22222222-2222-4222-8222-222222222222';
const initialRevision = '10000000-0000-4000-8000-000000000001';
const nextRevision = '10000000-0000-4000-8000-000000000002';
const finalRevision = '10000000-0000-4000-8000-000000000003';
type UpdateResponse = { ok: boolean; configurationRevision?: string; error?: string; errorCode?: Code | string };
type SaveHook = ReturnType<typeof usePostConfigSave>;

let root: Root;
let container: HTMLDivElement;
let update: SaveHook;
let updateSecond: SaveHook;
let queryClient: QueryClient;
let activePostId: string;
let activeRevision: string;
let activeRoomLocale: string;

function Harness() {
  update = usePostConfigSave(activePostId, activeRevision);
  return <span>{activeRoomLocale}</span>;
}

function TwoHookHarness() {
  update = usePostConfigSave(activePostId, activeRevision);
  updateSecond = usePostConfigSave(activePostId, activeRevision);
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

function render(harness: typeof Harness | typeof TwoHookHarness = Harness) {
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        {harness === Harness ? <Harness /> : <TwoHookHarness />}
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  activePostId = postId;
  activeRevision = initialRevision;
  activeRoomLocale = 'ko';
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  render();
});

afterEach(() => {
  act(() => root.unmount());
  clearEditorSaveRecovery(`post:${postId}:configuration`);
  clearEditorSaveRecovery(`post:${secondPostId}:configuration`);
  queryClient.clear();
  container.remove();
  window.sessionStorage.clear();
  vi.useRealTimers();
});

describe('Post config saves', () => {
  it('waits for A acknowledgement and uses its revision for the next latest-field write', async () => {
    const requests: Array<{
      patch: PostConfigPatch;
      expectedConfigurationRevision: string;
      response: ReturnType<typeof deferred<UpdateResponse>>;
    }> = [];
    mocks.updatePostAction.mockImplementation(
      (_targetPostId: string, patch: PostConfigPatch, expectedConfigurationRevision: string) => {
        const response = deferred<UpdateResponse>();
        requests.push({ patch, expectedConfigurationRevision, response });
        return response.promise;
      },
    );

    act(() => update({ commentsEnabled: false }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(
      requests.map(({ patch, expectedConfigurationRevision }) => ({ patch, expectedConfigurationRevision })),
    ).toEqual([{ patch: { commentsEnabled: false }, expectedConfigurationRevision: initialRevision }]);

    act(() => update({ commentsEnabled: true }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(requests).toHaveLength(1);

    await act(async () => {
      requests[0].response.resolve({ ok: true, configurationRevision: nextRevision });
      await settlePromises();
    });
    expect(
      requests.map(({ patch, expectedConfigurationRevision }) => ({ patch, expectedConfigurationRevision })),
    ).toEqual([
      { patch: { commentsEnabled: false }, expectedConfigurationRevision: initialRevision },
      { patch: { commentsEnabled: true }, expectedConfigurationRevision: nextRevision },
    ]);

    await act(async () => {
      requests[1].response.resolve({ ok: true, configurationRevision: finalRevision });
      await settlePromises();
    });
  });

  it('retries transient failures with the same resident revision', async () => {
    mocks.updatePostAction
      .mockResolvedValueOnce({ ok: false, error: 'permission denied', errorCode: 'POST_UPDATE_FAILED' })
      .mockResolvedValueOnce({ ok: true, success: true, configurationRevision: nextRevision });
    act(() => update({ documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' } }));

    let firstFlush = true;
    await act(async () => {
      firstFlush = await flushEditorSaves(`post:${postId}`);
    });
    expect(firstFlush).toBe(false);
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'permission denied', color: 'red' }),
    );

    let retryFlush = false;
    await act(async () => {
      retryFlush = await flushEditorSaves(`post:${postId}`);
    });
    expect(retryFlush).toBe(true);
    expect(mocks.updatePostAction).toHaveBeenCalledTimes(2);
    expect(mocks.updatePostAction).toHaveBeenNthCalledWith(
      1,
      postId,
      { documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' } },
      initialRevision,
    );
    expect(mocks.updatePostAction).toHaveBeenNthCalledWith(
      2,
      postId,
      { documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' } },
      initialRevision,
    );
  });

  it('sends slug and other settings through one queue', async () => {
    mocks.updatePostAction.mockResolvedValue({ ok: true, configurationRevision: nextRevision });
    act(() => update({ commentsEnabled: false }));
    act(() => update({ slug: 'new-post-slug' }));
    act(() => update({ mapPlaceId: 'place-1' }));

    let flushed = false;
    await act(async () => {
      flushed = await update.flush();
    });

    expect(flushed).toBe(true);
    expect(mocks.updatePostAction).toHaveBeenCalledExactlyOnceWith(
      postId,
      { commentsEnabled: false, slug: 'new-post-slug', mapPlaceId: 'place-1' },
      initialRevision,
    );
  });

  it('keeps the server revision after a no-op acknowledgement', async () => {
    mocks.updatePostAction
      .mockResolvedValueOnce({ ok: true, configurationRevision: initialRevision })
      .mockResolvedValueOnce({ ok: true, configurationRevision: nextRevision });

    act(() => update({ commentsEnabled: true }));
    await act(async () => {
      expect(await update.flush()).toBe(true);
    });
    act(() => update({ commentsEnabled: false }));
    await act(async () => {
      expect(await update.flush()).toBe(true);
    });

    expect(mocks.updatePostAction).toHaveBeenNthCalledWith(1, postId, { commentsEnabled: true }, initialRevision);
    expect(mocks.updatePostAction).toHaveBeenNthCalledWith(2, postId, { commentsEnabled: false }, initialRevision);
  });

  it('keeps the patch when an acknowledgement omits its revision', async () => {
    mocks.updatePostAction.mockResolvedValueOnce({ ok: true });
    act(() => update({ mapPlaceId: 'unconfirmed-place' }));
    let flushed = true;
    await act(async () => {
      flushed = await update.flush();
    });

    expect(flushed).toBe(false);
    expect(update.configurationRevision).toBe(initialRevision);
    expect(update.getPendingPatch()).toEqual({ mapPlaceId: 'unconfirmed-place' });
    expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'updateFailed', color: 'red' }));
  });

  it('does not rebase its resident revision when the same Post receives refreshed props', async () => {
    mocks.updatePostAction.mockResolvedValueOnce({ ok: true, configurationRevision: nextRevision });
    act(() => update({ commentsEnabled: false }));
    activeRevision = finalRevision;
    render();

    await act(async () => {
      expect(await update.flush()).toBe(true);
    });

    expect(mocks.updatePostAction).toHaveBeenCalledExactlyOnceWith(postId, { commentsEnabled: false }, initialRevision);
  });

  it('keeps entity-wide settings in the Post queue when the active room locale changes', async () => {
    mocks.updatePostAction.mockResolvedValueOnce({ ok: true, configurationRevision: nextRevision });
    act(() => update({ commentsEnabled: false }));
    activeRoomLocale = 'ja';
    render();

    await act(async () => {
      expect(await update.flush()).toBe(true);
    });

    expect(mocks.updatePostAction).toHaveBeenCalledExactlyOnceWith(postId, { commentsEnabled: false }, initialRevision);
    expect(container.textContent).toContain('ja');
  });

  it('retains and blocks a stale second client without rebasing after a conflict', async () => {
    render(TwoHookHarness);
    mocks.updatePostAction
      .mockResolvedValueOnce({ ok: true, configurationRevision: nextRevision })
      .mockResolvedValueOnce({ ok: false, error: 'A newer version was saved', errorCode: Code.Aborted });

    act(() => update({ commentsEnabled: false }));
    await act(async () => {
      expect(await update.flush()).toBe(true);
    });

    act(() => updateSecond({ mapPlaceId: 'stale-place' }));
    let staleFlush = true;
    await act(async () => {
      staleFlush = await updateSecond.flush();
    });
    expect(staleFlush).toBe(false);
    expect(updateSecond.conflict).toBe(true);
    expect(updateSecond.configurationRevision).toBe(initialRevision);
    expect(updateSecond.getPendingPatch()).toEqual({ mapPlaceId: 'stale-place' });

    act(() => updateSecond({ slug: 'latest-local-slug' }));
    let blockedFlush = true;
    await act(async () => {
      blockedFlush = await updateSecond.flush();
    });
    expect(blockedFlush).toBe(false);
    expect(updateSecond.getPendingPatch()).toEqual({ mapPlaceId: 'stale-place', slug: 'latest-local-slug' });
    let navigationFlush = true;
    await act(async () => {
      navigationFlush = await flushEditorSaves(`post:${postId}`);
    });
    expect(navigationFlush).toBe(false);
    expect(mocks.updatePostAction).toHaveBeenCalledTimes(2);
    expect(mocks.updatePostAction).toHaveBeenNthCalledWith(2, postId, { mapPlaceId: 'stale-place' }, initialRevision);
  });

  it('shows reload recovery when the server requires a resident revision', async () => {
    mocks.updatePostAction.mockResolvedValueOnce({
      ok: false,
      error: 'Reload this Post before saving',
      errorCode: Code.FailedPrecondition,
    });
    act(() => update({ slug: 'draft-slug' }));
    let flushed = true;
    await act(async () => {
      flushed = await update.flush();
    });

    expect(flushed).toBe(false);
    expect(update.conflict).toBe(true);
    expect(update.configurationRevision).toBe(initialRevision);
    expect(update.getPendingPatch()).toEqual({ slug: 'draft-slug' });
  });

  it('keeps a pending patch in its Post when the editor changes IDs', async () => {
    act(() => update({ commentsEnabled: false }));
    const oldPostSave = update;
    activePostId = secondPostId;
    activeRevision = finalRevision;
    render();
    expect(readEditorSaveRecovery(`post:${postId}:configuration`)).toMatchObject({
      entries: [{ document: `post:${postId}`, patch: { commentsEnabled: false } }],
    });

    act(() => oldPostSave({ slug: 'old-post-slug' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mocks.updatePostAction).not.toHaveBeenCalled();

    mocks.updatePostAction.mockResolvedValueOnce({ ok: true, configurationRevision: initialRevision });
    act(() => update({ mapPlaceId: 'new-post-place' }));
    await act(async () => {
      expect(await update.flush()).toBe(true);
    });
    expect(mocks.updatePostAction).toHaveBeenCalledExactlyOnceWith(
      secondPostId,
      { mapPlaceId: 'new-post-place' },
      finalRevision,
    );
  });

  it.each([
    ['acknowledgement', { ok: true, configurationRevision: nextRevision }],
    ['conflict', { ok: false, error: 'A newer version was saved', errorCode: Code.Aborted }],
  ] as const)('ignores an old A %s after switching A to B and back to A', async (_kind, delayedResult) => {
    const response = deferred<UpdateResponse>();
    mocks.updatePostAction.mockReturnValueOnce(response.promise);
    const oldUpdate = update;
    let oldFlush!: Promise<boolean>;
    act(() => {
      oldUpdate({ commentsEnabled: false });
      oldFlush = oldUpdate.flush();
    });
    await act(async () => {
      await settlePromises();
    });
    expect(mocks.updatePostAction).toHaveBeenCalledExactlyOnceWith(postId, { commentsEnabled: false }, initialRevision);

    activePostId = secondPostId;
    activeRevision = finalRevision;
    render();
    activePostId = postId;
    activeRevision = initialRevision;
    render();

    await act(async () => {
      response.resolve(delayedResult);
      await oldFlush;
      await settlePromises();
    });
    expect(update.configurationRevision).toBe(initialRevision);
    expect(update.conflict).toBe(false);

    mocks.updatePostAction.mockResolvedValueOnce({ ok: true, configurationRevision: finalRevision });
    act(() => update({ slug: 'fresh-a-slug' }));
    await act(async () => {
      expect(await update.flush()).toBe(true);
    });
    expect(mocks.updatePostAction).toHaveBeenNthCalledWith(2, postId, { slug: 'fresh-a-slug' }, initialRevision);
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
