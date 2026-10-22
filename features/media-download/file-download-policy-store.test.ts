import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentType } from '@echovisionlab/geul-proto/secure/audience_pb.ts';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import type {
  AudienceSegmentSummary,
  FileDownloadActionResult,
  FileDownloadPolicyModel,
  FileDownloadPolicyTarget,
} from '@/lib/types/file-download-access';
import {
  createFileDownloadPolicyStore,
  type FileDownloadPolicyEditorAdapter,
  type FileDownloadPolicyStore,
} from './file-download-policy-store';

const defaultTarget: FileDownloadPolicyTarget = {
  entityType: TranscodeEntityType.POST,
  entityId: 'post-1',
  blockId: 'block-1',
  referencePath: 'file',
  expectedFileId: 'file-1',
};

type SaveResult = FileDownloadActionResult<FileDownloadPolicyModel>;
type LoadSegmentsResult = Awaited<ReturnType<FileDownloadPolicyEditorAdapter['loadSegments']>>;

function segment(id: string, name: string): AudienceSegmentSummary {
  return { id, name, description: '', segmentType: SegmentType.MEMBERS_BY_FILTER };
}

function page(items: AudienceSegmentSummary[], pageNumber = 1, hasMore = false) {
  return {
    data: {
      items,
      page: pageNumber,
      pageSize: 50,
      total: hasMore ? 51 : items.length,
      totalPages: hasMore ? 2 : 1,
      hasMore,
    },
  };
}

/** The API echoes the exact selector of the request; tests supply only the File and Audience. */
function echoTarget(adapter: FileDownloadPolicyEditorAdapter): FileDownloadPolicyEditorAdapter {
  const echo = (result: SaveResult, target: FileDownloadPolicyTarget): SaveResult =>
    result.data
      ? {
          data: {
            ...result.data,
            entityType: target.entityType,
            entityId: target.entityId,
            blockId: target.blockId,
            referencePath: target.referencePath,
          },
        }
      : result;
  return {
    loadPolicy: async (target) => echo(await adapter.loadPolicy(target), target),
    loadSegments: adapter.loadSegments,
    savePolicy: async (target, audience, audienceSegmentIds, observedPolicy, editorOrigin) =>
      echo(await adapter.savePolicy(target, audience, audienceSegmentIds, observedPolicy, editorOrigin), target),
  };
}

const started: FileDownloadPolicyStore[] = [];

function startStore(adapter: FileDownloadPolicyEditorAdapter, target = defaultTarget) {
  const onDetachedSaveFailure = vi.fn<(staleTarget: boolean) => void>();
  const store = createFileDownloadPolicyStore(target, { onDetachedSaveFailure });
  store.start(echoTarget(adapter));
  started.push(store);
  return { store, onDetachedSaveFailure, state: () => store.api.getState() };
}

async function settle() {
  for (let index = 0; index < 20; index += 1) {
    await Promise.resolve();
  }
}

async function flushAutosave(delay = 250) {
  await vi.advanceTimersByTimeAsync(delay);
  await settle();
}

function policy(audience: FileDownloadPolicyModel['audience'], audienceSegments: AudienceSegmentSummary[] = []) {
  return { data: { fileId: 'file-1', audience, audienceSegments } };
}

afterEach(() => {
  for (const store of started.splice(0)) {
    store.stop();
  }
  vi.useRealTimers();
});

describe('file download policy store', () => {
  it('ignores a peer read that completes after a newer local policy save', async () => {
    vi.useFakeTimers();
    const olderRead = Promise.withResolvers<SaveResult>();
    const canonical = policy('authenticated');
    const loadPolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['loadPolicy']>()
      .mockResolvedValueOnce(policy('public'))
      .mockReturnValueOnce(olderRead.promise)
      .mockResolvedValue(canonical);
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>().mockResolvedValue(canonical);
    const { store, state } = startStore({ loadPolicy, savePolicy, loadSegments: vi.fn(async () => page([])) });
    await settle();
    store.notifyPeerChange();
    await settle();
    expect(loadPolicy).toHaveBeenCalledTimes(2);

    store.changeAccess('authenticated', []);
    await flushAutosave();
    expect(state().audience).toBe('authenticated');
    olderRead.resolve(policy('public'));
    await settle();

    expect(state().audience).toBe('authenticated');
    expect(savePolicy).toHaveBeenCalledTimes(1);
  });

  it('reloads the exact selector after a peer hint that arrived during a save', async () => {
    vi.useFakeTimers();
    const saving = Promise.withResolvers<SaveResult>();
    const loadPolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['loadPolicy']>()
      .mockResolvedValueOnce(policy('public'))
      .mockResolvedValueOnce({ data: { fileId: 'replacement-file', audience: 'disabled', audienceSegments: [] } });
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>().mockReturnValueOnce(saving.promise);
    const { store, state } = startStore({ loadPolicy, savePolicy, loadSegments: vi.fn(async () => page([])) });
    await settle();
    store.changeAccess('authenticated', []);
    await flushAutosave();
    store.notifyPeerChange();
    await flushAutosave();
    expect(loadPolicy).toHaveBeenCalledTimes(1);
    expect(state().audience).toBe('authenticated');

    saving.resolve(policy('authenticated'));
    await settle();

    expect(loadPolicy).toHaveBeenCalledTimes(2);
    expect(loadPolicy).toHaveBeenLastCalledWith(defaultTarget);
    expect(state().targetStale).toBe(true);
  });

  it('blocks edits when a peer refresh shows that the exact selector now points at another file', async () => {
    const loadPolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['loadPolicy']>()
      .mockResolvedValueOnce(policy('public'))
      .mockResolvedValueOnce({ data: { fileId: 'file-2', audience: 'authenticated', audienceSegments: [] } });
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>();
    const { store, state } = startStore({ loadPolicy, savePolicy, loadSegments: vi.fn(async () => page([])) });
    await settle();
    store.notifyPeerChange();
    await settle();

    expect(state()).toMatchObject({ targetStale: true, error: 'reloadRequired' });
    vi.useFakeTimers();
    store.changeAccess('disabled', []);
    await flushAutosave();
    expect(savePolicy).not.toHaveBeenCalled();
  });

  it('refetches the exact policy after a stale write and retries the local segment delta over the fresh baseline', async () => {
    const loadPolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['loadPolicy']>()
      .mockResolvedValueOnce(policy('restricted', [segment('segment-a', 'A')]))
      .mockResolvedValueOnce(policy('restricted', [segment('segment-a', 'A'), segment('segment-peer', 'Peer')]));
    const savePolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['savePolicy']>()
      .mockResolvedValueOnce({ errorCode: 'staleTarget' })
      .mockResolvedValueOnce(
        policy('restricted', [segment('segment-a', 'A'), segment('segment-b', 'B'), segment('segment-peer', 'Peer')]),
      );
    const { store, state } = startStore({
      loadPolicy,
      loadSegments: vi.fn(async () =>
        page([segment('segment-a', 'A'), segment('segment-b', 'B'), segment('segment-peer', 'Peer')]),
      ),
      savePolicy,
    });
    await settle();
    vi.useFakeTimers();
    store.changeAccess('restricted', ['segment-a', 'segment-b']);
    await flushAutosave();
    await flushAutosave(1);

    expect(loadPolicy).toHaveBeenLastCalledWith(defaultTarget);
    expect(savePolicy).toHaveBeenCalledTimes(2);
    expect(savePolicy).toHaveBeenNthCalledWith(
      1,
      defaultTarget,
      'restricted',
      ['segment-a', 'segment-b'],
      { audience: 'restricted', audienceSegmentIds: ['segment-a'] },
      expect.any(String),
    );
    expect(savePolicy).toHaveBeenNthCalledWith(
      2,
      defaultTarget,
      'restricted',
      ['segment-a', 'segment-b', 'segment-peer'],
      { audience: 'restricted', audienceSegmentIds: ['segment-a', 'segment-peer'] },
      expect.any(String),
    );
    expect(state().audienceSegmentIds).toEqual(['segment-a', 'segment-b', 'segment-peer']);
  });

  it('stops a stale-target retry when the exact selector resolves to a replacement file', async () => {
    const loadPolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['loadPolicy']>()
      .mockResolvedValueOnce(policy('public'))
      .mockResolvedValueOnce({ data: { fileId: 'file-2', audience: 'authenticated', audienceSegments: [] } });
    const savePolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['savePolicy']>()
      .mockResolvedValue({ errorCode: 'staleTarget' });
    const { store, state } = startStore({ loadPolicy, savePolicy, loadSegments: vi.fn(async () => page([])) });
    await settle();
    vi.useFakeTimers();
    store.changeAccess('disabled', []);
    await flushAutosave();

    expect(loadPolicy).toHaveBeenCalledTimes(2);
    expect(loadPolicy).toHaveBeenLastCalledWith(defaultTarget);
    expect(savePolicy).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({ targetStale: true, error: 'reloadRequired' });
  });

  it('keeps a retry draft when the same File still matches after a second stale response', async () => {
    const loadPolicy = vi.fn<FileDownloadPolicyEditorAdapter['loadPolicy']>().mockResolvedValue(policy('public'));
    const savePolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['savePolicy']>()
      .mockResolvedValue({ errorCode: 'staleTarget' });
    const { store, state } = startStore({ loadPolicy, savePolicy, loadSegments: vi.fn(async () => page([])) });
    await settle();
    vi.useFakeTimers();
    store.changeAccess('disabled', []);
    await flushAutosave();
    await flushAutosave(1);

    expect(savePolicy).toHaveBeenCalledTimes(2);
    expect(loadPolicy).toHaveBeenCalledTimes(3);
    expect(state()).toMatchObject({ audience: 'disabled', targetStale: false, error: 'saveError' });
  });

  it('auto-saves a changed audience after the pause and reports it saved', async () => {
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>(async (_target, audience) =>
      policy(audience),
    );
    const { store, state } = startStore({
      loadPolicy: vi.fn(async () => policy('public')),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    });
    await settle();
    vi.useFakeTimers();
    store.changeAccess('authenticated', []);
    expect(state()).toMatchObject({ saving: true, saved: false });
    await flushAutosave(249);
    expect(savePolicy).not.toHaveBeenCalled();
    await flushAutosave(1);

    expect(savePolicy).toHaveBeenCalledWith(defaultTarget, 'authenticated', [], expect.any(Object), expect.any(String));
    expect(state()).toMatchObject({ audience: 'authenticated', saving: false, saved: true, error: null });
  });

  it('serializes rapid changes so the latest audience wins', async () => {
    const latestSave = Promise.withResolvers<SaveResult>();
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>(() => latestSave.promise);
    const { store, state } = startStore({
      loadPolicy: vi.fn(async () => policy('disabled')),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    });
    await settle();
    vi.useFakeTimers();
    store.changeAccess('public', []);
    store.changeAccess('authenticated', []);
    store.changeAccess('disabled', []);

    expect(savePolicy).not.toHaveBeenCalled();
    await flushAutosave();
    expect(savePolicy).toHaveBeenCalledTimes(1);
    expect(savePolicy).toHaveBeenCalledWith(defaultTarget, 'disabled', [], expect.any(Object), expect.any(String));
    latestSave.resolve(policy('disabled'));
    await settle();

    expect(savePolicy).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({ audience: 'disabled', saved: true });
  });

  it('rebases a queued segment removal onto the canonical first save without dropping a peer addition', async () => {
    const base = segment('segment-base', 'Base segment');
    const local = segment('segment-local', 'Local segment');
    const peer = segment('segment-peer', 'Peer segment');
    const firstSave = Promise.withResolvers<SaveResult>();
    const savePolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['savePolicy']>()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementation(async (_target, audience, audienceSegmentIds) =>
        policy(
          audience,
          [base, local, peer].filter((item) => audienceSegmentIds.includes(item.id)),
        ),
      );
    const { store, state } = startStore({
      loadPolicy: vi.fn(async () => policy('restricted', [base])),
      loadSegments: vi.fn(async () => page([base, local, peer])),
      savePolicy,
    });
    await settle();
    vi.useFakeTimers();

    store.changeAccess('restricted', [base.id, local.id]);
    await flushAutosave();
    expect(savePolicy).toHaveBeenCalledTimes(1);
    expect(savePolicy).toHaveBeenNthCalledWith(
      1,
      defaultTarget,
      'restricted',
      [base.id, local.id],
      { audience: 'restricted', audienceSegmentIds: [base.id] },
      expect.any(String),
    );

    store.changeAccess('restricted', [local.id]);
    firstSave.resolve(policy('restricted', [base, local, peer]));
    await settle();
    await flushAutosave();

    expect(savePolicy).toHaveBeenCalledTimes(2);
    expect(savePolicy).toHaveBeenNthCalledWith(
      2,
      defaultTarget,
      'restricted',
      [local.id, peer.id],
      { audience: 'restricted', audienceSegmentIds: [base.id, local.id, peer.id] },
      expect.any(String),
    );
    expect(state().audienceSegmentIds).toEqual([local.id, peer.id]);
  });

  it('rolls a failed queued change back to the most recent confirmed save', async () => {
    const firstSave = Promise.withResolvers<SaveResult>();
    const savePolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['savePolicy']>()
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValueOnce({ errorCode: 'saveFailed' });
    const { store, state } = startStore({
      loadPolicy: vi.fn(async () => policy('disabled')),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    });
    await settle();
    vi.useFakeTimers();

    store.changeAccess('public', []);
    await flushAutosave();
    store.changeAccess('authenticated', []);
    await flushAutosave();
    firstSave.resolve(policy('public'));
    await settle();
    await flushAutosave(0);

    expect(savePolicy).toHaveBeenNthCalledWith(1, defaultTarget, 'public', [], expect.any(Object), expect.any(String));
    expect(savePolicy).toHaveBeenNthCalledWith(
      2,
      defaultTarget,
      'authenticated',
      [],
      expect.any(Object),
      expect.any(String),
    );
    expect(state()).toMatchObject({ audience: 'public', error: 'saveError', saved: false });
  });

  it('writes the latest pending value when stopped before the pause, once and without a failure', async () => {
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>(async (_target, audience) =>
      policy(audience),
    );
    const { store, onDetachedSaveFailure } = startStore({
      loadPolicy: vi.fn(async () => policy('disabled')),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    });
    await settle();
    vi.useFakeTimers();
    store.changeAccess('public', []);
    store.stop();

    expect(savePolicy).toHaveBeenCalledTimes(1);
    expect(savePolicy).toHaveBeenCalledWith(defaultTarget, 'public', [], expect.any(Object), expect.any(String));
    await vi.runAllTimersAsync();
    await settle();
    expect(savePolicy).toHaveBeenCalledTimes(1);
    expect(onDetachedSaveFailure).not.toHaveBeenCalled();
  });

  it.each([
    { result: { errorCode: 'saveFailed' as const }, staleTarget: false },
    { result: { errorCode: 'staleTarget' as const }, staleTarget: true },
  ])('reports a $result.errorCode write that finished after the editor stopped', async ({ result, staleTarget }) => {
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>(async () => result);
    const adapter = {
      loadPolicy: vi.fn(async () => policy('public')),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };
    const { store, onDetachedSaveFailure } = startStore(adapter);
    await settle();
    vi.useFakeTimers();
    store.changeAccess('disabled', []);
    store.stop();
    await settle();

    expect(savePolicy).toHaveBeenCalledWith(defaultTarget, 'disabled', [], expect.any(Object), expect.any(String));
    expect(onDetachedSaveFailure).toHaveBeenCalledWith(staleTarget);

    const remounted = startStore(adapter);
    await settle();
    expect(remounted.state()).toMatchObject({ audience: 'public', saved: false });
  });

  it('has unsaved changes while a policy write is pending or active', async () => {
    const activeSave = Promise.withResolvers<SaveResult>();
    const { store, onDetachedSaveFailure } = startStore({
      loadPolicy: vi.fn(async () => policy('public')),
      loadSegments: vi.fn(async () => page([])),
      savePolicy: vi.fn(() => activeSave.promise),
    });
    await settle();
    vi.useFakeTimers();
    store.changeAccess('disabled', []);
    expect(store.hasUnsavedChanges()).toBe(true);

    await flushAutosave();
    expect(store.hasUnsavedChanges()).toBe(true);

    activeSave.resolve(policy('disabled'));
    await settle();
    expect(store.hasUnsavedChanges()).toBe(false);
    expect(onDetachedSaveFailure).not.toHaveBeenCalled();
  });

  it('writes the latest pending value after an active save settles when stopped', async () => {
    const activeSave = Promise.withResolvers<SaveResult>();
    const savePolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['savePolicy']>()
      .mockImplementationOnce(() => activeSave.promise)
      .mockImplementation(async (_target, audience) => policy(audience));
    const { store } = startStore({
      loadPolicy: vi.fn(async () => policy('disabled')),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    });
    await settle();
    vi.useFakeTimers();
    store.changeAccess('public', []);
    await flushAutosave();
    expect(savePolicy).toHaveBeenCalledTimes(1);

    store.changeAccess('authenticated', []);
    store.stop();
    expect(savePolicy).toHaveBeenCalledTimes(1);
    activeSave.resolve(policy('public'));
    await settle();

    expect(savePolicy).toHaveBeenCalledTimes(2);
    expect(savePolicy).toHaveBeenLastCalledWith(
      defaultTarget,
      'authenticated',
      [],
      expect.any(Object),
      expect.any(String),
    );
    await vi.runAllTimersAsync();
    expect(savePolicy).toHaveBeenCalledTimes(2);
  });

  it('drains old same-target writes before a new editor reads, and saves its latest value last', async () => {
    const activeSave = Promise.withResolvers<SaveResult>();
    let persistedAudience: FileDownloadPolicyModel['audience'] = 'disabled';
    let saveInvocation = 0;
    const order: string[] = [];
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => {
        order.push(`load:${persistedAudience}`);
        return policy(persistedAudience);
      }),
      loadSegments: vi.fn(async () => page([])),
      savePolicy: vi.fn(async (_target, audience) => {
        saveInvocation += 1;
        order.push(`save:${audience}`);
        if (saveInvocation === 1) {
          const result = await activeSave.promise;
          persistedAudience = result.data?.audience ?? persistedAudience;
          return result;
        }
        persistedAudience = audience;
        return policy(audience);
      }),
    };
    const first = startStore(adapter);
    await settle();
    vi.useFakeTimers();
    first.store.changeAccess('public', []);
    await flushAutosave();
    first.store.changeAccess('authenticated', []);
    first.store.stop();

    const second = startStore(adapter);
    await settle();
    expect(adapter.loadPolicy).toHaveBeenCalledTimes(1);
    expect(second.state().loading).toBe(true);

    activeSave.resolve(policy('public'));
    await settle();
    expect(adapter.savePolicy).toHaveBeenCalledTimes(2);
    expect(adapter.loadPolicy).toHaveBeenCalledTimes(2);
    expect(second.state().audience).toBe('authenticated');

    second.store.changeAccess('public', []);
    await flushAutosave();
    expect(order).toEqual(['load:disabled', 'save:public', 'save:authenticated', 'load:authenticated', 'save:public']);
  });

  it('keeps a pending write to an old target from blocking or overwriting a new target', async () => {
    const oldTargetSave = Promise.withResolvers<SaveResult>();
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>((target, audience) =>
      target.expectedFileId === 'file-1'
        ? oldTargetSave.promise
        : Promise.resolve({ data: { fileId: target.expectedFileId, audience, audienceSegments: [] } }),
    );
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async (target) => ({
        data: { fileId: target.expectedFileId, audience: 'disabled' as const, audienceSegments: [] },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };
    const first = startStore(adapter);
    await settle();
    vi.useFakeTimers();
    first.store.changeAccess('public', []);
    await flushAutosave();
    first.store.stop();

    const nextTarget = { ...defaultTarget, expectedFileId: 'file-2' };
    const second = startStore(adapter, nextTarget);
    await settle();
    second.store.changeAccess('authenticated', []);
    await flushAutosave();

    expect(savePolicy).toHaveBeenCalledTimes(2);
    expect(savePolicy).toHaveBeenLastCalledWith(
      nextTarget,
      'authenticated',
      [],
      expect.any(Object),
      expect.any(String),
    );
    oldTargetSave.resolve(policy('public'));
    await settle();
    expect(second.state().audience).toBe('authenticated');
  });

  it('ignores a load for an old target that completes after the editor moved on', async () => {
    const oldTargetLoad = Promise.withResolvers<SaveResult>();
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>();
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn((target) =>
        target.expectedFileId === 'file-1'
          ? oldTargetLoad.promise
          : Promise.resolve({
              data: { fileId: target.expectedFileId, audience: 'public' as const, audienceSegments: [] },
            }),
      ),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };
    vi.useFakeTimers();
    const first = startStore(adapter);
    await settle();
    first.store.stop();
    const second = startStore(adapter, { ...defaultTarget, expectedFileId: 'file-2' });
    await settle();

    oldTargetLoad.resolve(policy('restricted'));
    await settle();
    await vi.runAllTimersAsync();

    expect(first.state().policyLoaded).toBe(false);
    expect(second.state().audience).toBe('public');
    expect(savePolicy).not.toHaveBeenCalled();
  });

  it('searches every page of matching Audiences once per search', async () => {
    const audiences = Array.from({ length: 125 }, (_, index) =>
      segment(`segment-${index + 1}`, `Audience ${index + 1}`),
    );
    const loadSegments = vi.fn<FileDownloadPolicyEditorAdapter['loadSegments']>(
      async ({ page: pageNumber = 1, pageSize = 50, search = '' }) => {
        const matching = search ? audiences.filter((audience) => audience.name.includes(search)) : audiences;
        const start = (pageNumber - 1) * pageSize;
        return {
          data: {
            items: matching.slice(start, start + pageSize),
            page: pageNumber,
            pageSize,
            total: matching.length,
            totalPages: Math.max(1, Math.ceil(matching.length / pageSize)),
            hasMore: start + pageSize < matching.length,
          },
        };
      },
    );
    vi.useFakeTimers();
    const { store, state } = startStore({
      loadPolicy: vi.fn(async () => policy('restricted', [audiences[0]])),
      loadSegments,
      savePolicy: vi.fn(),
    });
    await settle();

    store.searchSegments('Audience');
    await flushAutosave(200);

    expect(loadSegments).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 50 });
    expect(loadSegments).toHaveBeenNthCalledWith(2, { page: 1, pageSize: 50, search: 'Audience' });
    expect(loadSegments).toHaveBeenNthCalledWith(3, { page: 2, pageSize: 50, search: 'Audience' });
    expect(loadSegments).toHaveBeenNthCalledWith(4, { page: 3, pageSize: 50, search: 'Audience' });
    expect(loadSegments).toHaveBeenCalledTimes(4);
    expect(state().segments.map((item) => item.name)).toContain('Audience 125');
    expect(state().segmentsLoadingMore).toBe(false);

    store.searchSegments('');
    store.searchSegments('Audience');
    await flushAutosave(200);
    expect(loadSegments).toHaveBeenCalledTimes(4);
  });

  it('reports Audience loading until a later search page arrives', async () => {
    const laterPage = Promise.withResolvers<LoadSegmentsResult>();
    const firstAudience = segment('segment-1', 'Audience 1');
    const loadSegments = vi.fn<FileDownloadPolicyEditorAdapter['loadSegments']>(({ page: pageNumber = 1 }) =>
      pageNumber === 1 ? Promise.resolve(page([firstAudience], 1, true)) : laterPage.promise,
    );
    const { store, state } = startStore({
      loadPolicy: vi.fn(async () => policy('restricted', [firstAudience])),
      loadSegments,
      savePolicy: vi.fn(),
    });
    await settle();
    vi.useFakeTimers();
    store.searchSegments('Audience');
    await flushAutosave(200);

    expect(loadSegments).toHaveBeenCalledTimes(3);
    expect(state().segmentsLoadingMore).toBe(true);
    laterPage.resolve(page([segment('segment-2', 'Audience 2')], 2, false));
    await settle();
    expect(state().segmentsLoadingMore).toBe(false);
    expect(state().segments.map((item) => item.name)).toContain('Audience 2');
  });

  it('keeps a selected Audience that is outside the first list page', async () => {
    const { state } = startStore({
      loadPolicy: vi.fn(async () => policy('restricted', [segment('later-page-segment', 'Tour members')])),
      loadSegments: vi.fn(async () => page([segment('first-page-segment', 'Members')])),
      savePolicy: vi.fn(),
    });
    await settle();

    expect(state().audienceSegmentIds).toEqual(['later-page-segment']);
    expect(state().segments.map((item) => item.id)).toEqual(['later-page-segment', 'first-page-segment']);
    expect(state()).toMatchObject({ loading: false, targetStale: false });
  });

  it('keeps a restricted policy without Audiences unchanged instead of saving it', async () => {
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>();
    vi.useFakeTimers();
    const { state } = startStore({
      loadPolicy: vi.fn(async () => policy('restricted')),
      loadSegments: vi.fn(async () => page([segment('active-segment', 'Members')])),
      savePolicy,
    });
    await settle();
    await flushAutosave();

    expect(savePolicy).not.toHaveBeenCalled();
    expect(state()).toMatchObject({ audience: 'restricted', audienceSegmentIds: [], saved: false });
  });
});
