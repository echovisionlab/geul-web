// @vitest-environment jsdom

import { Code } from '@connectrpc/connect';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import { flushEditorSaves } from '@/lib/editor/editor-save-registry';
import { clearEditorSaveRecovery, readEditorSaveRecovery } from '@/lib/editor/editor-save-recovery';
import type { DocumentLayout } from '@/features/document-layout';
import type { PostConfigurationSnapshot } from '@/lib/types/post/model';
import { diffPostLayout, type PostConfigPatch } from './post-config-save';
import { usePostConfigSave } from './usePostConfigSave';

const mocks = vi.hoisted(() => ({
  updatePostAction: vi.fn(),
  getPostConfigurationAction: vi.fn(),
  publishEditorEntityChange: vi.fn(),
  entityChange: null as null | (() => void | Promise<void>),
}));
vi.mock('@/lib/actions/post', () => ({
  updatePostAction: mocks.updatePostAction,
  getPostConfigurationAction: mocks.getPostConfigurationAction,
}));
vi.mock('@/lib/editor/editor-entity-changes', () => ({
  publishEditorEntityChange: mocks.publishEditorEntityChange,
  useEditorEntityChanges: (_document: string, onChange: () => void | Promise<void>) => {
    mocks.entityChange = onChange;
  },
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

const postId = '11111111-1111-4111-8111-111111111111';
const secondPostId = '22222222-2222-4222-8222-222222222222';
const initialRevision = '10000000-0000-4000-8000-000000000001';
const nextRevision = '10000000-0000-4000-8000-000000000002';
const finalRevision = '10000000-0000-4000-8000-000000000003';
const latestRevision = '10000000-0000-4000-8000-000000000004';
type UpdateResponse = {
  ok: boolean;
  success?: true;
  configurationRevision?: string;
  configuration?: PostConfigurationSnapshot;
  error?: string;
  errorCode?: Code | string;
};
type SaveHook = ReturnType<typeof usePostConfigSave>;

let root: Root;
let container: HTMLDivElement;
let update: SaveHook;
let updateSecond: SaveHook;
let queryClient: QueryClient;
let activePostId: string;
let activeRevision: string;
let activeRoomLocale: string;

const initialLayout: DocumentLayout = { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' };

function configuration(
  revision: string,
  overrides: Partial<PostConfigurationSnapshot> = {},
): PostConfigurationSnapshot {
  return {
    configurationRevision: revision,
    slug: null,
    commentsEnabled: true,
    mapPlaceId: null,
    documentLayout: initialLayout,
    ...overrides,
  };
}

function updateSuccess(revision: string, overrides: Partial<PostConfigurationSnapshot> = {}): UpdateResponse {
  return {
    ok: true,
    success: true,
    configurationRevision: revision,
    configuration: configuration(revision, overrides),
  };
}

function actionFailure(error: string, errorCode: Code | string): UpdateResponse {
  return { ok: false, error, errorCode };
}

function actionConfiguration(revision: string, overrides: Partial<PostConfigurationSnapshot> = {}) {
  return { ok: true, configuration: configuration(revision, overrides) };
}

function Harness() {
  update = usePostConfigSave(activePostId, configuration(activeRevision));
  return <span>{activeRoomLocale}</span>;
}

function TwoHookHarness() {
  update = usePostConfigSave(activePostId, configuration(activeRevision));
  updateSecond = usePostConfigSave(activePostId, configuration(activeRevision));
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

async function signalEntityChange() {
  const callback = mocks.entityChange;
  if (!callback) {
    throw new Error('Post configuration change listener is not registered');
  }
  await act(async () => {
    await callback();
    await settlePromises();
  });
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
  mocks.entityChange = null;
  activePostId = postId;
  activeRevision = initialRevision;
  activeRoomLocale = 'ko';
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  mocks.updatePostAction.mockImplementation((_postId: string, _patch: PostConfigPatch, revision: string) =>
    Promise.resolve(updateSuccess(nextRevision, { configurationRevision: revision })),
  );
  mocks.getPostConfigurationAction.mockResolvedValue(actionConfiguration(nextRevision));
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
  it('captures only the nested layout fields changed by the local editor', () => {
    expect(
      diffPostLayout(
        { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' },
        { contentHeight: 'content', pageChrome: 'pinned', footer: 'flow' },
      ),
    ).toEqual({ layoutPageChrome: 'pinned' });
  });

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
      requests[0].response.resolve(updateSuccess(nextRevision, { commentsEnabled: false }));
      await settlePromises();
    });
    expect(
      requests.map(({ patch, expectedConfigurationRevision }) => ({ patch, expectedConfigurationRevision })),
    ).toEqual([
      { patch: { commentsEnabled: false }, expectedConfigurationRevision: initialRevision },
      { patch: { commentsEnabled: true }, expectedConfigurationRevision: nextRevision },
    ]);

    await act(async () => {
      requests[1].response.resolve(updateSuccess(finalRevision, { commentsEnabled: true }));
      await settlePromises();
    });
  });

  it('retries transient failures with the same resident revision', async () => {
    mocks.updatePostAction
      .mockResolvedValueOnce(actionFailure('permission denied', 'POST_UPDATE_FAILED'))
      .mockResolvedValueOnce(
        updateSuccess(nextRevision, {
          documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' },
        }),
      );
    act(() => update({ layoutContentHeight: 'viewport', layoutPageChrome: 'pinned' }));

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
    mocks.updatePostAction.mockResolvedValue(updateSuccess(nextRevision));
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
      .mockResolvedValueOnce(updateSuccess(initialRevision))
      .mockResolvedValueOnce(updateSuccess(nextRevision));

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
    mocks.updatePostAction.mockResolvedValueOnce(updateSuccess(nextRevision));
    act(() => update({ commentsEnabled: false }));
    activeRevision = finalRevision;
    render();

    await act(async () => {
      expect(await update.flush()).toBe(true);
    });

    expect(mocks.updatePostAction).toHaveBeenCalledExactlyOnceWith(postId, { commentsEnabled: false }, initialRevision);
  });

  it('keeps entity-wide settings in the Post queue when the active room locale changes', async () => {
    mocks.updatePostAction.mockResolvedValueOnce(updateSuccess(nextRevision));
    act(() => update({ commentsEnabled: false }));
    activeRoomLocale = 'ja';
    render();

    await act(async () => {
      expect(await update.flush()).toBe(true);
    });

    expect(mocks.updatePostAction).toHaveBeenCalledExactlyOnceWith(postId, { commentsEnabled: false }, initialRevision);
    expect(container.textContent).toContain('ja');
  });

  it('merges a disjoint stale scalar setting and retries once against the latest revision', async () => {
    render(TwoHookHarness);
    mocks.updatePostAction
      .mockResolvedValueOnce(updateSuccess(nextRevision, { commentsEnabled: false }))
      .mockResolvedValueOnce(actionFailure('A newer version was saved', Code.Aborted))
      .mockResolvedValueOnce(updateSuccess(finalRevision, { commentsEnabled: false, mapPlaceId: 'stale-place' }));
    mocks.getPostConfigurationAction.mockResolvedValueOnce(
      actionConfiguration(nextRevision, { commentsEnabled: false }),
    );

    act(() => update({ commentsEnabled: false }));
    await act(async () => {
      expect(await update.flush()).toBe(true);
    });

    act(() => updateSecond({ mapPlaceId: 'stale-place' }));
    let staleFlush = false;
    await act(async () => {
      staleFlush = await updateSecond.flush();
    });
    expect(staleFlush).toBe(true);
    expect(updateSecond.conflict).toBe(false);
    expect(updateSecond.configurationRevision).toBe(finalRevision);
    expect(updateSecond.getPendingPatch()).toBeNull();
    expect(mocks.getPostConfigurationAction).toHaveBeenCalledExactlyOnceWith(postId);
    expect(mocks.updatePostAction).toHaveBeenNthCalledWith(2, postId, { mapPlaceId: 'stale-place' }, initialRevision);
    expect(mocks.updatePostAction).toHaveBeenNthCalledWith(3, postId, { mapPlaceId: 'stale-place' }, nextRevision);
  });

  it('uses same-field last save wins after a stale revision', async () => {
    render(TwoHookHarness);
    mocks.updatePostAction
      .mockResolvedValueOnce(updateSuccess(nextRevision, { commentsEnabled: false }))
      .mockResolvedValueOnce(actionFailure('A newer version was saved', Code.Aborted))
      .mockResolvedValueOnce(updateSuccess(finalRevision, { commentsEnabled: true }));
    mocks.getPostConfigurationAction.mockResolvedValueOnce(
      actionConfiguration(nextRevision, { commentsEnabled: false }),
    );

    act(() => update({ commentsEnabled: false }));
    await act(async () => {
      expect(await update.flush()).toBe(true);
    });
    act(() => updateSecond({ commentsEnabled: true }));
    await act(async () => {
      expect(await updateSecond.flush()).toBe(true);
    });

    expect(mocks.updatePostAction).toHaveBeenNthCalledWith(3, postId, { commentsEnabled: true }, nextRevision);
    expect(updateSecond.configurationRevision).toBe(finalRevision);
  });

  it('refetches peer configuration changes and preserves local pending fields', async () => {
    render();
    const remoteLayout: DocumentLayout = { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'pinned' };
    mocks.getPostConfigurationAction.mockResolvedValueOnce(
      actionConfiguration(nextRevision, { commentsEnabled: true, documentLayout: remoteLayout }),
    );
    mocks.updatePostAction.mockResolvedValueOnce(
      updateSuccess(finalRevision, { commentsEnabled: false, documentLayout: remoteLayout }),
    );
    act(() => update({ commentsEnabled: false }));

    await signalEntityChange();
    expect(update.configuration).toEqual(
      configuration(nextRevision, { commentsEnabled: false, documentLayout: remoteLayout }),
    );

    await act(async () => {
      expect(await update.flush()).toBe(true);
    });
    expect(mocks.updatePostAction).toHaveBeenCalledExactlyOnceWith(postId, { commentsEnabled: false }, nextRevision);
    expect(mocks.publishEditorEntityChange).toHaveBeenCalledExactlyOnceWith(`post:${postId}`);
    expect(update.configuration).toEqual(
      configuration(finalRevision, { commentsEnabled: false, documentLayout: remoteLayout }),
    );
  });

  it('does not replace a newer peer snapshot with an older in-flight acknowledgement', async () => {
    const response = deferred<UpdateResponse>();
    mocks.updatePostAction.mockReturnValueOnce(response.promise);
    mocks.getPostConfigurationAction
      .mockResolvedValueOnce(actionConfiguration(finalRevision, { commentsEnabled: true, mapPlaceId: 'peer-place' }))
      .mockResolvedValueOnce(actionConfiguration(latestRevision, { commentsEnabled: true, mapPlaceId: 'peer-place' }));
    render();
    act(() => update({ commentsEnabled: false }));
    let flushPromise!: Promise<boolean>;
    act(() => {
      flushPromise = update.flush();
    });
    await settlePromises();

    await signalEntityChange();
    response.resolve(updateSuccess(nextRevision, { commentsEnabled: false }));
    await act(async () => {
      expect(await flushPromise).toBe(true);
      await settlePromises();
    });

    expect(update.configurationRevision).toBe(latestRevision);
    expect(update.configuration.commentsEnabled).toBe(true);
    expect(update.configuration.mapPlaceId).toBe('peer-place');
  });

  it('merges only changed layout keys over the latest server layout', async () => {
    const currentLayout: DocumentLayout = { contentHeight: 'viewport', pageChrome: 'flow', footer: 'pinned' };
    const expectedMergedLayout: DocumentLayout = { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'pinned' };
    mocks.updatePostAction
      .mockResolvedValueOnce(actionFailure('A newer version was saved', Code.Aborted))
      .mockResolvedValueOnce(updateSuccess(nextRevision, { documentLayout: expectedMergedLayout }));
    mocks.getPostConfigurationAction.mockResolvedValueOnce(
      actionConfiguration(finalRevision, { documentLayout: currentLayout }),
    );
    act(() => update({ layoutPageChrome: 'pinned' }));
    await act(async () => {
      expect(await update.flush()).toBe(true);
    });

    expect(mocks.updatePostAction).toHaveBeenNthCalledWith(
      1,
      postId,
      { documentLayout: { contentHeight: 'content', pageChrome: 'pinned', footer: 'flow' } },
      initialRevision,
    );
    expect(mocks.updatePostAction).toHaveBeenNthCalledWith(
      2,
      postId,
      { documentLayout: expectedMergedLayout },
      finalRevision,
    );
    expect(update.configurationRevision).toBe(nextRevision);
  });

  it('retains a sparse patch when the single automatic retry also conflicts', async () => {
    mocks.updatePostAction
      .mockResolvedValueOnce(actionFailure('A newer version was saved', Code.Aborted))
      .mockResolvedValueOnce(actionFailure('A newer version was saved', Code.Aborted));
    mocks.getPostConfigurationAction.mockResolvedValueOnce(actionConfiguration(nextRevision));
    act(() => update({ layoutFooter: 'pinned' }));
    let flushed = true;
    await act(async () => {
      flushed = await update.flush();
    });

    expect(flushed).toBe(false);
    expect(update.conflict).toBe(false);
    expect(update.configurationRevision).toBe(nextRevision);
    expect(update.getPendingPatch()).toEqual({ layoutFooter: 'pinned' });
    expect(mocks.updatePostAction).toHaveBeenCalledTimes(2);
    expect(mocks.getPostConfigurationAction).toHaveBeenCalledExactlyOnceWith(postId);
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

    mocks.updatePostAction.mockResolvedValueOnce(updateSuccess(initialRevision));
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
    ['acknowledgement', updateSuccess(nextRevision)],
    ['conflict', actionFailure('A newer version was saved', Code.Aborted)],
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

    mocks.updatePostAction.mockResolvedValueOnce(updateSuccess(finalRevision));
    act(() => update({ slug: 'fresh-a-slug' }));
    await act(async () => {
      expect(await update.flush()).toBe(true);
    });
    // Returning to A resumes its unacknowledged local intent. The old A
    // response still cannot move this new resident's configuration revision.
    expect(mocks.updatePostAction).toHaveBeenNthCalledWith(
      2,
      postId,
      { commentsEnabled: false, slug: 'fresh-a-slug' },
      initialRevision,
    );
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
