import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemberCriteriaKind } from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import type {
  MemberCriteriaSummary,
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
type LoadCriteriaListResult = Awaited<ReturnType<FileDownloadPolicyEditorAdapter['loadCriteriaList']>>;

function criteria(id: string, name: string): MemberCriteriaSummary {
  return { id, name, description: '', kind: MemberCriteriaKind.FILTER };
}

function page(items: MemberCriteriaSummary[], pageNumber = 1, hasMore = false) {
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

/** The API echoes the exact selector of the request; tests supply only the File and Access. */
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
    loadCriteriaList: adapter.loadCriteriaList,
    savePolicy: async (target, access, memberCriteriaIds, observedPolicy, editorOrigin) =>
      echo(await adapter.savePolicy(target, access, memberCriteriaIds, observedPolicy, editorOrigin), target),
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

function policy(access: FileDownloadPolicyModel['access'], memberCriteria: MemberCriteriaSummary[] = []) {
  return { data: { fileId: 'file-1', access, memberCriteria } };
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
    const { store, state } = startStore({ loadPolicy, savePolicy, loadCriteriaList: vi.fn(async () => page([])) });
    await settle();
    store.notifyPeerChange();
    await settle();
    expect(loadPolicy).toHaveBeenCalledTimes(2);

    store.changeAccess('authenticated', []);
    await flushAutosave();
    expect(state().access).toBe('authenticated');
    olderRead.resolve(policy('public'));
    await settle();

    expect(state().access).toBe('authenticated');
    expect(savePolicy).toHaveBeenCalledTimes(1);
  });

  it('reloads the exact selector after a peer hint that arrived during a save', async () => {
    vi.useFakeTimers();
    const saving = Promise.withResolvers<SaveResult>();
    const loadPolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['loadPolicy']>()
      .mockResolvedValueOnce(policy('public'))
      .mockResolvedValueOnce({ data: { fileId: 'replacement-file', access: 'disabled', memberCriteria: [] } });
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>().mockReturnValueOnce(saving.promise);
    const { store, state } = startStore({ loadPolicy, savePolicy, loadCriteriaList: vi.fn(async () => page([])) });
    await settle();
    store.changeAccess('authenticated', []);
    await flushAutosave();
    store.notifyPeerChange();
    await flushAutosave();
    expect(loadPolicy).toHaveBeenCalledTimes(1);
    expect(state().access).toBe('authenticated');

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
      .mockResolvedValueOnce({ data: { fileId: 'file-2', access: 'authenticated', memberCriteria: [] } });
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>();
    const { store, state } = startStore({ loadPolicy, savePolicy, loadCriteriaList: vi.fn(async () => page([])) });
    await settle();
    store.notifyPeerChange();
    await settle();

    expect(state()).toMatchObject({ targetStale: true, error: 'reloadRequired' });
    vi.useFakeTimers();
    store.changeAccess('disabled', []);
    await flushAutosave();
    expect(savePolicy).not.toHaveBeenCalled();
  });

  it('refetches the exact policy after a stale write and retries the local criteria delta over the fresh baseline', async () => {
    const loadPolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['loadPolicy']>()
      .mockResolvedValueOnce(policy('restricted', [criteria('criteria-a', 'A')]))
      .mockResolvedValueOnce(policy('restricted', [criteria('criteria-a', 'A'), criteria('criteria-peer', 'Peer')]));
    const savePolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['savePolicy']>()
      .mockResolvedValueOnce({ errorCode: 'staleTarget' })
      .mockResolvedValueOnce(
        policy('restricted', [
          criteria('criteria-a', 'A'),
          criteria('criteria-b', 'B'),
          criteria('criteria-peer', 'Peer'),
        ]),
      );
    const { store, state } = startStore({
      loadPolicy,
      loadCriteriaList: vi.fn(async () =>
        page([criteria('criteria-a', 'A'), criteria('criteria-b', 'B'), criteria('criteria-peer', 'Peer')]),
      ),
      savePolicy,
    });
    await settle();
    vi.useFakeTimers();
    store.changeAccess('restricted', ['criteria-a', 'criteria-b']);
    await flushAutosave();
    await flushAutosave(1);

    expect(loadPolicy).toHaveBeenLastCalledWith(defaultTarget);
    expect(savePolicy).toHaveBeenCalledTimes(2);
    expect(savePolicy).toHaveBeenNthCalledWith(
      1,
      defaultTarget,
      'restricted',
      ['criteria-a', 'criteria-b'],
      { access: 'restricted', memberCriteriaIds: ['criteria-a'] },
      expect.any(String),
    );
    expect(savePolicy).toHaveBeenNthCalledWith(
      2,
      defaultTarget,
      'restricted',
      ['criteria-a', 'criteria-b', 'criteria-peer'],
      { access: 'restricted', memberCriteriaIds: ['criteria-a', 'criteria-peer'] },
      expect.any(String),
    );
    expect(state().memberCriteriaIds).toEqual(['criteria-a', 'criteria-b', 'criteria-peer']);
  });

  it('stops a stale-target retry when the exact selector resolves to a replacement file', async () => {
    const loadPolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['loadPolicy']>()
      .mockResolvedValueOnce(policy('public'))
      .mockResolvedValueOnce({ data: { fileId: 'file-2', access: 'authenticated', memberCriteria: [] } });
    const savePolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['savePolicy']>()
      .mockResolvedValue({ errorCode: 'staleTarget' });
    const { store, state } = startStore({ loadPolicy, savePolicy, loadCriteriaList: vi.fn(async () => page([])) });
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
    const { store, state } = startStore({ loadPolicy, savePolicy, loadCriteriaList: vi.fn(async () => page([])) });
    await settle();
    vi.useFakeTimers();
    store.changeAccess('disabled', []);
    await flushAutosave();
    await flushAutosave(1);

    expect(savePolicy).toHaveBeenCalledTimes(2);
    expect(loadPolicy).toHaveBeenCalledTimes(3);
    expect(state()).toMatchObject({ access: 'disabled', targetStale: false, error: 'saveError' });
  });

  it('auto-saves a changed access after the pause and reports it saved', async () => {
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>(async (_target, access) => policy(access));
    const { store, state } = startStore({
      loadPolicy: vi.fn(async () => policy('public')),
      loadCriteriaList: vi.fn(async () => page([])),
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
    expect(state()).toMatchObject({ access: 'authenticated', saving: false, saved: true, error: null });
  });

  it('serializes rapid changes so the latest access wins', async () => {
    const latestSave = Promise.withResolvers<SaveResult>();
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>(() => latestSave.promise);
    const { store, state } = startStore({
      loadPolicy: vi.fn(async () => policy('disabled')),
      loadCriteriaList: vi.fn(async () => page([])),
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
    expect(state()).toMatchObject({ access: 'disabled', saved: true });
  });

  it('rebases a queued criteria removal onto the canonical first save without dropping a peer addition', async () => {
    const base = criteria('criteria-base', 'Base criteria');
    const local = criteria('criteria-local', 'Local criteria');
    const peer = criteria('criteria-peer', 'Peer criteria');
    const firstSave = Promise.withResolvers<SaveResult>();
    const savePolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['savePolicy']>()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementation(async (_target, access, memberCriteriaIds) =>
        policy(
          access,
          [base, local, peer].filter((item) => memberCriteriaIds.includes(item.id)),
        ),
      );
    const { store, state } = startStore({
      loadPolicy: vi.fn(async () => policy('restricted', [base])),
      loadCriteriaList: vi.fn(async () => page([base, local, peer])),
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
      { access: 'restricted', memberCriteriaIds: [base.id] },
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
      { access: 'restricted', memberCriteriaIds: [base.id, local.id, peer.id] },
      expect.any(String),
    );
    expect(state().memberCriteriaIds).toEqual([local.id, peer.id]);
  });

  it('rolls a failed queued change back to the most recent confirmed save', async () => {
    const firstSave = Promise.withResolvers<SaveResult>();
    const savePolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['savePolicy']>()
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValueOnce({ errorCode: 'saveFailed' });
    const { store, state } = startStore({
      loadPolicy: vi.fn(async () => policy('disabled')),
      loadCriteriaList: vi.fn(async () => page([])),
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
    expect(state()).toMatchObject({ access: 'public', error: 'saveError', saved: false });
  });

  it('writes the latest pending value when stopped before the pause, once and without a failure', async () => {
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>(async (_target, access) => policy(access));
    const { store, onDetachedSaveFailure } = startStore({
      loadPolicy: vi.fn(async () => policy('disabled')),
      loadCriteriaList: vi.fn(async () => page([])),
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
      loadCriteriaList: vi.fn(async () => page([])),
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
    expect(remounted.state()).toMatchObject({ access: 'public', saved: false });
  });

  it('has unsaved changes while a policy write is pending or active', async () => {
    const activeSave = Promise.withResolvers<SaveResult>();
    const { store, onDetachedSaveFailure } = startStore({
      loadPolicy: vi.fn(async () => policy('public')),
      loadCriteriaList: vi.fn(async () => page([])),
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
      .mockImplementation(async (_target, access) => policy(access));
    const { store } = startStore({
      loadPolicy: vi.fn(async () => policy('disabled')),
      loadCriteriaList: vi.fn(async () => page([])),
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
    let persistedAccess: FileDownloadPolicyModel['access'] = 'disabled';
    let saveInvocation = 0;
    const order: string[] = [];
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => {
        order.push(`load:${persistedAccess}`);
        return policy(persistedAccess);
      }),
      loadCriteriaList: vi.fn(async () => page([])),
      savePolicy: vi.fn(async (_target, access) => {
        saveInvocation += 1;
        order.push(`save:${access}`);
        if (saveInvocation === 1) {
          const result = await activeSave.promise;
          persistedAccess = result.data?.access ?? persistedAccess;
          return result;
        }
        persistedAccess = access;
        return policy(access);
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
    expect(second.state().access).toBe('authenticated');

    second.store.changeAccess('public', []);
    await flushAutosave();
    expect(order).toEqual(['load:disabled', 'save:public', 'save:authenticated', 'load:authenticated', 'save:public']);
  });

  it('keeps a pending write to an old target from blocking or overwriting a new target', async () => {
    const oldTargetSave = Promise.withResolvers<SaveResult>();
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>((target, access) =>
      target.expectedFileId === 'file-1'
        ? oldTargetSave.promise
        : Promise.resolve({ data: { fileId: target.expectedFileId, access, memberCriteria: [] } }),
    );
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async (target) => ({
        data: { fileId: target.expectedFileId, access: 'disabled' as const, memberCriteria: [] },
      })),
      loadCriteriaList: vi.fn(async () => page([])),
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
    expect(second.state().access).toBe('authenticated');
  });

  it('ignores a load for an old target that completes after the editor moved on', async () => {
    const oldTargetLoad = Promise.withResolvers<SaveResult>();
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>();
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn((target) =>
        target.expectedFileId === 'file-1'
          ? oldTargetLoad.promise
          : Promise.resolve({
              data: { fileId: target.expectedFileId, access: 'public' as const, memberCriteria: [] },
            }),
      ),
      loadCriteriaList: vi.fn(async () => page([])),
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
    expect(second.state().access).toBe('public');
    expect(savePolicy).not.toHaveBeenCalled();
  });

  it('searches every page of matching Member criteria once per search', async () => {
    const criteriaList = Array.from({ length: 125 }, (_, index) =>
      criteria(`criteria-${index + 1}`, `Criteria ${index + 1}`),
    );
    const loadCriteriaList = vi.fn<FileDownloadPolicyEditorAdapter['loadCriteriaList']>(
      async ({ page: pageNumber = 1, pageSize = 50, search = '' }) => {
        const matching = search ? criteriaList.filter((item) => item.name.includes(search)) : criteriaList;
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
      loadPolicy: vi.fn(async () => policy('restricted', [criteriaList[0]])),
      loadCriteriaList,
      savePolicy: vi.fn(),
    });
    await settle();

    store.searchCriteriaList('Criteria');
    await flushAutosave(200);

    expect(loadCriteriaList).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 50 });
    expect(loadCriteriaList).toHaveBeenNthCalledWith(2, { page: 1, pageSize: 50, search: 'Criteria' });
    expect(loadCriteriaList).toHaveBeenNthCalledWith(3, { page: 2, pageSize: 50, search: 'Criteria' });
    expect(loadCriteriaList).toHaveBeenNthCalledWith(4, { page: 3, pageSize: 50, search: 'Criteria' });
    expect(loadCriteriaList).toHaveBeenCalledTimes(4);
    expect(state().criteriaList.map((item) => item.name)).toContain('Criteria 125');
    expect(state().criteriaListLoadingMore).toBe(false);

    store.searchCriteriaList('');
    store.searchCriteriaList('Criteria');
    await flushAutosave(200);
    expect(loadCriteriaList).toHaveBeenCalledTimes(4);
  });

  it('reports Access loading until a later search page arrives', async () => {
    const laterPage = Promise.withResolvers<LoadCriteriaListResult>();
    const firstAccess = criteria('criteria-1', 'Access 1');
    const loadCriteriaList = vi.fn<FileDownloadPolicyEditorAdapter['loadCriteriaList']>(({ page: pageNumber = 1 }) =>
      pageNumber === 1 ? Promise.resolve(page([firstAccess], 1, true)) : laterPage.promise,
    );
    const { store, state } = startStore({
      loadPolicy: vi.fn(async () => policy('restricted', [firstAccess])),
      loadCriteriaList,
      savePolicy: vi.fn(),
    });
    await settle();
    vi.useFakeTimers();
    store.searchCriteriaList('Criteria');
    await flushAutosave(200);

    expect(loadCriteriaList).toHaveBeenCalledTimes(3);
    expect(state().criteriaListLoadingMore).toBe(true);
    laterPage.resolve(page([criteria('criteria-2', 'Access 2')], 2, false));
    await settle();
    expect(state().criteriaListLoadingMore).toBe(false);
    expect(state().criteriaList.map((item) => item.name)).toContain('Access 2');
  });

  it('keeps a selected Access that is outside the first list page', async () => {
    const { state } = startStore({
      loadPolicy: vi.fn(async () => policy('restricted', [criteria('later-page-criteria', 'Tour members')])),
      loadCriteriaList: vi.fn(async () => page([criteria('first-page-criteria', 'Members')])),
      savePolicy: vi.fn(),
    });
    await settle();

    expect(state().memberCriteriaIds).toEqual(['later-page-criteria']);
    expect(state().criteriaList.map((item) => item.id)).toEqual(['later-page-criteria', 'first-page-criteria']);
    expect(state()).toMatchObject({ loading: false, targetStale: false });
  });

  it('keeps a restricted policy without AccessList unchanged instead of saving it', async () => {
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>();
    vi.useFakeTimers();
    const { state } = startStore({
      loadPolicy: vi.fn(async () => policy('restricted')),
      loadCriteriaList: vi.fn(async () => page([criteria('active-criteria', 'Members')])),
      savePolicy,
    });
    await settle();
    await flushAutosave();

    expect(savePolicy).not.toHaveBeenCalled();
    expect(state()).toMatchObject({ access: 'restricted', memberCriteriaIds: [], saved: false });
  });
});
