import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  MemberCriteriaSummary,
  FileDownloadActionResult,
  FileDownloadAccess,
  FileDownloadPage,
  FileDownloadPageInput,
  FileDownloadPolicyModel,
  FileDownloadPolicyObservedState,
  FileDownloadPolicyTarget,
} from '@/lib/types/file-download-access';
import { publishEditorEntityChange } from '@/lib/editor/editor-entity-changes';
import { AuthoritativeConfiguration } from '@/lib/editor/useAuthoritativeConfiguration';
import { getUntrackedConfigurationWriteOrigin } from '@/lib/editor/editor-write-origin';
import { policyMatchesTarget, policyChangeDocument } from './file-download-policy-state';
import {
  enqueueFileDownloadPolicyWrite,
  runAfterFileDownloadPolicyWrites,
} from './file-download-policy-write-coordinator';

export interface FileDownloadPolicyEditorAdapter {
  loadPolicy: (target: FileDownloadPolicyTarget) => Promise<FileDownloadActionResult<FileDownloadPolicyModel>>;
  loadCriteriaList: (
    input: FileDownloadPageInput,
  ) => Promise<FileDownloadActionResult<FileDownloadPage<MemberCriteriaSummary>>>;
  savePolicy: (
    target: FileDownloadPolicyTarget,
    access: FileDownloadAccess,
    memberCriteriaIds: string[],
    observedPolicy: FileDownloadPolicyObservedState,
    editorOrigin?: string,
  ) => Promise<FileDownloadActionResult<FileDownloadPolicyModel>>;
}

/** The view translates these; `reloadRequired` also means the target now points at another File. */
export type FileDownloadPolicyError = 'loadError' | 'saveError' | 'reloadRequired';

export interface FileDownloadPolicyState {
  access: FileDownloadAccess;
  memberCriteriaIds: string[];
  /** AccessList the editor can show, merged from the policy, list pages and searches. */
  criteriaList: MemberCriteriaSummary[];
  availableCriteriaIds: string[];
  criteriaSearch: string;
  criteriaListLoadingMore: boolean;
  criteriaListLoaded: boolean;
  criteriaListLoadFailed: boolean;
  loading: boolean;
  policyLoaded: boolean;
  saving: boolean;
  saved: boolean;
  targetStale: boolean;
  error: FileDownloadPolicyError | null;
}

export interface FileDownloadPolicyStore {
  readonly api: StoreApi<FileDownloadPolicyState>;
  readonly target: FileDownloadPolicyTarget;
  readonly document: string;
  readonly enabled: boolean;
  /** Loads the policy and the first Access page. A later start reloads from a clean state. */
  start: (adapter: FileDownloadPolicyEditorAdapter) => void;
  /** Stops in-flight work; a pending change is still written, and its failure is reported. */
  stop: () => void;
  changeAccess: (access: FileDownloadAccess, memberCriteriaIds: string[]) => void;
  searchCriteriaList: (search: string) => void;
  /** Another editor or the owning entity changed the policy. */
  notifyPeerChange: () => void;
  captureOwnChange: (origin?: string) => () => boolean;
  hasUnsavedChanges: () => boolean;
}

export interface FileDownloadPolicyStoreOptions {
  /** A save that finished after the editor stopped or moved to another target failed. */
  onDetachedSaveFailure: (staleTarget: boolean) => void;
}

export const SEGMENTS_PAGE_SIZE = 50;
export const SEGMENT_SEARCH_DEBOUNCE_MS = 200;
export const POLICY_AUTOSAVE_DEBOUNCE_MS = 250;

interface PendingPolicySave {
  generation: number;
  sequence: number;
  observedPolicy: FileDownloadPolicyObservedState;
  access: FileDownloadAccess;
  memberCriteriaIds: string[];
  retryCount: number;
}

interface ActivePolicySave {
  token: symbol;
  request: PendingPolicySave;
}

interface ActiveCriteriaPagination {
  search: string;
  token: symbol;
  promise: Promise<void>;
}

function mergeCriteriaList(
  current: MemberCriteriaSummary[],
  incoming: MemberCriteriaSummary[],
): MemberCriteriaSummary[] {
  const byId = new Map(current.map((criteria) => [criteria.id, criteria]));
  for (const criteria of incoming) {
    byId.set(criteria.id, criteria);
  }
  return Array.from(byId.values());
}

function mergeIds(current: string[], incoming: MemberCriteriaSummary[]): string[] {
  return Array.from(new Set([...current, ...incoming.map((criteria) => criteria.id)]));
}

function sortedPolicyCriteriaIds(policy: FileDownloadPolicyModel): string[] {
  return policy.memberCriteria.map((criteria) => criteria.id).sort();
}

function applyCriteriaSelectionDelta(current: string[], observed: string[], desired: string[]): string[] {
  const next = new Set(current);
  const observedSet = new Set(observed);
  const desiredSet = new Set(desired);
  for (const id of observedSet) {
    if (!desiredSet.has(id)) {
      next.delete(id);
    }
  }
  for (const id of desiredSet) {
    if (!observedSet.has(id)) {
      next.add(id);
    }
  }
  return [...next].sort();
}

/** A queued change keeps its own delta over the save that was in flight when it was made. */
function rebasePendingSave(
  pending: PendingPolicySave,
  active: PendingPolicySave,
  acknowledged: FileDownloadPolicyObservedState,
): PendingPolicySave {
  const access = pending.access === active.access ? acknowledged.access : pending.access;
  const memberCriteriaIds = applyCriteriaSelectionDelta(
    acknowledged.memberCriteriaIds,
    active.access === 'restricted' ? active.memberCriteriaIds : [],
    pending.access === 'restricted' ? pending.memberCriteriaIds : [],
  );
  return {
    ...pending,
    observedPolicy: {
      access: acknowledged.access,
      memberCriteriaIds: acknowledged.memberCriteriaIds,
    },
    access,
    memberCriteriaIds: access === 'restricted' ? memberCriteriaIds : [],
  };
}

/** After a stale write, the local delta is retried over the freshly read policy. */
function rebasePendingSaveOntoCurrent(pending: PendingPolicySave, current: FileDownloadPolicyModel): PendingPolicySave {
  const currentState = {
    access: current.access,
    memberCriteriaIds: sortedPolicyCriteriaIds(current),
  } satisfies FileDownloadPolicyObservedState;
  const access = pending.access === pending.observedPolicy.access ? currentState.access : pending.access;
  const memberCriteriaIds =
    access === 'restricted'
      ? applyCriteriaSelectionDelta(
          currentState.memberCriteriaIds,
          pending.observedPolicy.memberCriteriaIds,
          pending.memberCriteriaIds,
        )
      : [];
  return {
    ...pending,
    observedPolicy: currentState,
    access,
    memberCriteriaIds,
    retryCount: pending.retryCount + 1,
  };
}

export function normalizeFileDownloadPolicyTarget(target: FileDownloadPolicyTarget): FileDownloadPolicyTarget {
  return {
    entityType: target.entityType,
    entityId: target.entityId.trim(),
    blockId: target.blockId?.trim() || undefined,
    referencePath: target.referencePath?.trim() || undefined,
    expectedFileId: target.expectedFileId.trim(),
  };
}

export function fileDownloadPolicyTargetKey(target: FileDownloadPolicyTarget): string {
  return `${target.entityType}:${target.entityId}:${target.blockId ?? ''}:${target.referencePath ?? ''}:${target.expectedFileId}`;
}

/**
 * Loads one File's download policy and saves Access changes to it. Changes save after a short
 * pause, one at a time per target; a change made during a save is rebased onto that save's result.
 */
export function createFileDownloadPolicyStore(
  target: FileDownloadPolicyTarget,
  options: FileDownloadPolicyStoreOptions,
): FileDownloadPolicyStore {
  const targetKey = fileDownloadPolicyTargetKey(target);
  const document = policyChangeDocument(target);
  const enabled = Boolean(target.entityId && target.expectedFileId);
  const configuration = new AuthoritativeConfiguration<FileDownloadPolicyObservedState>(
    document,
    { access: 'disabled', memberCriteriaIds: [] },
    () => {
      const { access, memberCriteriaIds } = configuration.getConfiguration();
      api.setState({ access, memberCriteriaIds });
    },
  );
  const api = createStore<FileDownloadPolicyState>()(() => ({
    access: 'disabled',
    memberCriteriaIds: [],
    criteriaList: [],
    availableCriteriaIds: [],
    criteriaSearch: '',
    criteriaListLoadingMore: false,
    criteriaListLoaded: false,
    criteriaListLoadFailed: false,
    loading: enabled,
    policyLoaded: false,
    saving: false,
    saved: false,
    targetStale: false,
    error: null,
  }));
  const set = api.setState;

  let adapter: FileDownloadPolicyEditorAdapter | null = null;
  let active = false;
  let runGeneration = 0;
  let criteriaPaginationGeneration = 0;
  let activeCriteriaPagination: ActiveCriteriaPagination | null = null;
  let criteriaSearchTimer: ReturnType<typeof setTimeout> | null = null;
  const loadedCriteriaSearches = new Set<string>();
  let saveGeneration = 0;
  let saveSequence = 0;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingSave: PendingPolicySave | null = null;
  let activeSave: ActivePolicySave | null = null;
  let peerRefreshRequested = false;
  let peerRefreshInFlight = false;
  let targetStale = false;
  let blockedSaveSequence: number | null = null;
  let hydrating = false;
  let initialPolicyReadStarted = false;
  let persistedPolicy: { access: FileDownloadAccess; memberCriteria: MemberCriteriaSummary[] } | null = null;

  const requireAdapter = (): FileDownloadPolicyEditorAdapter => {
    if (!adapter) {
      throw new Error('The file download policy store has not started.');
    }
    return adapter;
  };

  const markTargetStale = () => {
    targetStale = true;
    set({ targetStale: true, error: 'reloadRequired' });
  };

  const adoptPolicyCriteriaList = (policyCriteriaList: MemberCriteriaSummary[]) => {
    set((state) => ({
      criteriaList: mergeCriteriaList(state.criteriaList, policyCriteriaList),
      availableCriteriaIds: mergeIds(state.availableCriteriaIds, policyCriteriaList),
    }));
  };

  const refreshPolicyFromPeer = async (): Promise<void> => {
    if (!active) {
      return;
    }
    if (!enabled || targetStale || activeSave || pendingSave) {
      peerRefreshRequested = true;
      return;
    }
    if (peerRefreshInFlight) {
      peerRefreshRequested = true;
      return;
    }

    peerRefreshRequested = false;
    peerRefreshInFlight = true;
    const read = configuration.beginRead();
    const requestSequence = saveSequence;
    try {
      const result = await requireAdapter().loadPolicy(target);
      if (!active) {
        return;
      }
      if (requestSequence !== saveSequence || activeSave || pendingSave) {
        peerRefreshRequested = true;
        return;
      }
      if (!result.data) {
        set({ error: 'loadError' });
        return;
      }
      if (!policyMatchesTarget(result.data, target)) {
        markTargetStale();
        return;
      }

      persistedPolicy = { access: result.data.access, memberCriteria: result.data.memberCriteria };
      if (
        !configuration.adoptRead(read, {
          access: result.data.access,
          memberCriteriaIds: sortedPolicyCriteriaIds(result.data),
        })
      ) {
        peerRefreshRequested = true;
        return;
      }
      adoptPolicyCriteriaList(result.data.memberCriteria);
      set({ error: null, saved: false });
    } catch {
      if (active) {
        set({ error: 'loadError' });
      }
    } finally {
      peerRefreshInFlight = false;
      if (peerRefreshRequested && !activeSave && !pendingSave) {
        void refreshPolicyFromPeer();
      }
    }
  };

  const notifyPeerChange = () => {
    if (hydrating) {
      if (initialPolicyReadStarted) {
        peerRefreshRequested = true;
      }
      return;
    }
    peerRefreshRequested = true;
    if (!activeSave && !pendingSave) {
      void refreshPolicyFromPeer();
    }
  };

  const clearCriteriaSearchTimer = () => {
    if (criteriaSearchTimer) {
      clearTimeout(criteriaSearchTimer);
      criteriaSearchTimer = null;
    }
  };

  const clearSaveTimer = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  };

  const start = (nextAdapter: FileDownloadPolicyEditorAdapter) => {
    adapter = nextAdapter;
    active = true;
    const run = ++runGeneration;
    targetStale = false;
    blockedSaveSequence = null;
    peerRefreshRequested = false;
    set({ targetStale: false });
    persistedPolicy = null;
    hydrating = enabled;
    initialPolicyReadStarted = false;
    criteriaPaginationGeneration += 1;
    activeCriteriaPagination = null;
    loadedCriteriaSearches.clear();
    clearCriteriaSearchTimer();
    saveGeneration += 1;
    saveSequence += 1;
    clearSaveTimer();
    activeSave = null;

    if (!enabled) {
      configuration.adoptRead(configuration.beginRead(), { access: 'disabled', memberCriteriaIds: [] });
      set({
        criteriaList: [],
        availableCriteriaIds: [],
        criteriaSearch: '',
        criteriaListLoadingMore: false,
        criteriaListLoaded: false,
        criteriaListLoadFailed: false,
        error: null,
        policyLoaded: false,
        loading: false,
      });
      hydrating = false;
      return;
    }

    let initialRead = configuration.beginRead();
    set({
      loading: true,
      saving: false,
      criteriaSearch: '',
      criteriaListLoadingMore: false,
      criteriaListLoaded: false,
      criteriaListLoadFailed: false,
      error: null,
      saved: false,
      policyLoaded: false,
    });
    Promise.all([
      runAfterFileDownloadPolicyWrites(targetKey, () => {
        initialPolicyReadStarted = true;
        initialRead = configuration.beginRead();
        return nextAdapter.loadPolicy(target);
      }),
      nextAdapter.loadCriteriaList({ page: 1, pageSize: SEGMENTS_PAGE_SIZE }),
    ])
      .then(([policyResult, criteriaResult]) => {
        if (run !== runGeneration) {
          return;
        }
        if (!policyResult.data) {
          set({ error: 'loadError' });
          return;
        }
        if (!policyMatchesTarget(policyResult.data, target)) {
          markTargetStale();
          return;
        }
        const policyCriteriaList = policyResult.data.memberCriteria;
        const listedCriteriaList = criteriaResult.data?.items ?? [];
        persistedPolicy = { access: policyResult.data.access, memberCriteria: policyCriteriaList };
        if (
          !configuration.adoptRead(initialRead, {
            access: policyResult.data.access,
            memberCriteriaIds: policyCriteriaList.map((criteria) => criteria.id),
          })
        ) {
          peerRefreshRequested = true;
          return;
        }
        set({
          criteriaList: mergeCriteriaList(policyCriteriaList, listedCriteriaList),
          availableCriteriaIds: mergeIds(
            policyCriteriaList.map((criteria) => criteria.id),
            listedCriteriaList,
          ),
          criteriaListLoaded: Boolean(criteriaResult.data),
          policyLoaded: true,
          ...(criteriaResult.data ? {} : { criteriaListLoadFailed: true }),
        });
      })
      .catch(() => {
        if (run === runGeneration) {
          set({ error: 'loadError' });
        }
      })
      .finally(() => {
        if (run === runGeneration) {
          set({ loading: false });
          hydrating = false;
          if (peerRefreshRequested && !activeSave && !pendingSave) {
            void refreshPolicyFromPeer();
          }
        }
      });
  };

  const stop = () => {
    runGeneration += 1;
    active = false;
    hydrating = false;
    criteriaPaginationGeneration += 1;
    activeCriteriaPagination = null;
    clearCriteriaSearchTimer();
    const detachedRequest = pendingSave;
    saveGeneration += 1;
    clearSaveTimer();
    activeSave = null;
    pendingSave = null;
    if (!detachedRequest || !adapter) {
      return;
    }

    const detachedAdapter = adapter;
    const detachedOrigin = getUntrackedConfigurationWriteOrigin(document);
    void enqueueFileDownloadPolicyWrite(targetKey, () =>
      detachedAdapter.savePolicy(
        target,
        detachedRequest.access,
        detachedRequest.memberCriteriaIds,
        detachedRequest.observedPolicy,
        detachedOrigin,
      ),
    )
      .then((result) => {
        if (!result.data) {
          options.onDetachedSaveFailure(result.errorCode === 'staleTarget');
        } else if (!policyMatchesTarget(result.data, target)) {
          options.onDetachedSaveFailure(true);
        } else {
          publishEditorEntityChange(document, detachedOrigin);
        }
      })
      .catch(() => options.onDetachedSaveFailure(false));
  };

  const loadCriteriaListForSearch = (rawSearch: string): Promise<void> => {
    const search = rawSearch.trim();
    if (!search || loadedCriteriaSearches.has(search)) {
      return Promise.resolve();
    }

    const generation = ++criteriaPaginationGeneration;
    if (activeCriteriaPagination?.search === search) {
      return activeCriteriaPagination.promise;
    }

    const token = Symbol('file-download-criteria-pagination');
    const current = () => criteriaPaginationGeneration === generation;
    const promise = Promise.resolve().then(async () => {
      let nextPage = 1;
      let hasMore = true;
      set({ criteriaListLoadingMore: true, criteriaListLoadFailed: false });

      try {
        while (hasMore) {
          const result = await requireAdapter().loadCriteriaList({
            page: nextPage,
            pageSize: SEGMENTS_PAGE_SIZE,
            search,
          });
          if (!current()) {
            return;
          }
          if (
            !result.data ||
            result.data.page !== nextPage ||
            (result.data.hasMore && result.data.items.length === 0)
          ) {
            set({ criteriaListLoadFailed: true });
            return;
          }
          const items = result.data.items;
          set((state) => ({
            criteriaList: mergeCriteriaList(state.criteriaList, items),
            availableCriteriaIds: mergeIds(state.availableCriteriaIds, items),
            criteriaListLoaded: true,
          }));
          hasMore = result.data.hasMore;
          nextPage = result.data.page + 1;
        }
        if (current()) {
          loadedCriteriaSearches.add(search);
        }
      } catch {
        if (current()) {
          set({ criteriaListLoadFailed: true });
        }
      } finally {
        if (activeCriteriaPagination?.token === token && current()) {
          activeCriteriaPagination = null;
          set({ criteriaListLoadingMore: false });
        }
      }
    });

    activeCriteriaPagination = { search, token, promise };
    return promise;
  };

  const searchCriteriaList = (nextSearch: string) => {
    set({ criteriaSearch: nextSearch });
    criteriaPaginationGeneration += 1;
    activeCriteriaPagination = null;
    clearCriteriaSearchTimer();
    if (!nextSearch.trim() || loadedCriteriaSearches.has(nextSearch.trim())) {
      set({ criteriaListLoadingMore: false });
      return;
    }
    criteriaSearchTimer = setTimeout(() => {
      criteriaSearchTimer = null;
      void loadCriteriaListForSearch(nextSearch);
    }, SEGMENT_SEARCH_DEBOUNCE_MS);
  };

  const scheduleSaveFlush = (delay = POLICY_AUTOSAVE_DEBOUNCE_MS) => {
    clearSaveTimer();
    const scheduledGeneration = saveGeneration;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (saveGeneration === scheduledGeneration) {
        flushPendingSave();
      }
    }, delay);
  };

  /** The editor stopped, or restarted, while this save was in flight. */
  const isDetached = (token: symbol, request: PendingPolicySave) =>
    activeSave?.token !== token || request.generation !== saveGeneration;

  const restorePersistedPolicy = () => {
    const persisted = persistedPolicy;
    if (persisted) {
      configuration.discard(['access', 'memberCriteriaIds']);
      set((state) => ({ criteriaList: mergeCriteriaList(state.criteriaList, persisted.memberCriteria) }));
    }
    set({ error: 'saveError' });
  };

  const retryStaleSave = async (
    token: symbol,
    request: PendingPolicySave,
    retryRequest: PendingPolicySave,
  ): Promise<void> => {
    try {
      const read = configuration.beginRead();
      const currentResult = await requireAdapter().loadPolicy(target);
      if (isDetached(token, request)) {
        return;
      }
      if (!currentResult.data || !policyMatchesTarget(currentResult.data, target)) {
        pendingSave = null;
        markTargetStale();
        return;
      }
      const currentPolicy = currentResult.data;
      configuration.adoptRead(read, {
        access: currentPolicy.access,
        memberCriteriaIds: sortedPolicyCriteriaIds(currentPolicy),
      });
      const rebased = rebasePendingSaveOntoCurrent(retryRequest, currentPolicy);
      persistedPolicy = { access: currentPolicy.access, memberCriteria: currentPolicy.memberCriteria };
      adoptPolicyCriteriaList(currentPolicy.memberCriteria);
      pendingSave = rebased;
      configuration.edit({ access: rebased.access, memberCriteriaIds: rebased.memberCriteriaIds });
      // A second stale response keeps the rebased draft but stops retrying it automatically.
      if (retryRequest.retryCount >= 1) {
        blockedSaveSequence = rebased.sequence;
        set({ error: 'saveError' });
        return;
      }
      blockedSaveSequence = null;
      set({ error: null });
    } catch {
      pendingSave = retryRequest;
      blockedSaveSequence = retryRequest.sequence;
      markTargetStale();
    }
  };

  function flushPendingSave() {
    const request = pendingSave;
    if (!request || activeSave || request.generation !== saveGeneration) {
      return;
    }
    if (request.sequence === blockedSaveSequence) {
      return;
    }

    pendingSave = null;
    const write = configuration.beginWrite(['access', 'memberCriteriaIds']);
    const token = Symbol('file-download-policy-save');
    activeSave = { token, request };
    const saveAdapter = requireAdapter();
    void enqueueFileDownloadPolicyWrite(targetKey, async () => {
      try {
        const result = await saveAdapter.savePolicy(
          target,
          request.access,
          request.memberCriteriaIds,
          request.observedPolicy,
          write.origin,
        );
        if (isDetached(token, request)) {
          write.fail();
          if (!result.data) {
            options.onDetachedSaveFailure(result.errorCode === 'staleTarget');
          } else if (!policyMatchesTarget(result.data, target)) {
            options.onDetachedSaveFailure(true);
          }
          return;
        }
        if (!result.data) {
          write.fail();
          if (result.errorCode === 'staleTarget') {
            await retryStaleSave(token, request, pendingSave ?? request);
            return;
          }
          if (request.sequence === saveSequence) {
            restorePersistedPolicy();
          }
          return;
        }
        if (!policyMatchesTarget(result.data, target)) {
          write.fail();
          pendingSave = null;
          markTargetStale();
          return;
        }
        const acknowledgedPolicy = {
          access: result.data.access,
          memberCriteriaIds: sortedPolicyCriteriaIds(result.data),
        } satisfies FileDownloadPolicyObservedState;
        write.acknowledge(acknowledgedPolicy);
        persistedPolicy = { access: result.data.access, memberCriteria: result.data.memberCriteria };
        adoptPolicyCriteriaList(result.data.memberCriteria);
        publishEditorEntityChange(document, write.origin);
        const pending = pendingSave;
        if (pending && pending.generation === request.generation && pending.sequence !== request.sequence) {
          const rebasedPending = rebasePendingSave(pending, request, acknowledgedPolicy);
          pendingSave = rebasedPending;
          configuration.edit({
            access: rebasedPending.access,
            memberCriteriaIds: rebasedPending.memberCriteriaIds,
          });
          set({ saved: false });
          return;
        }
        if (request.sequence !== saveSequence) {
          peerRefreshRequested = true;
          return;
        }
        set({ error: null, saved: true });
      } catch {
        write.fail();
        if (isDetached(token, request)) {
          options.onDetachedSaveFailure(false);
          return;
        }
        if (request.sequence === saveSequence) {
          restorePersistedPolicy();
        }
      } finally {
        if (activeSave?.token === token) {
          activeSave = null;
          const pending = pendingSave;
          if (pending && pending.generation === saveGeneration) {
            if (!saveTimer) {
              scheduleSaveFlush(0);
            }
          } else if (request.generation === saveGeneration) {
            set({ saving: false });
            if (peerRefreshRequested && !targetStale) {
              void refreshPolicyFromPeer();
            }
          }
        }
      }
    });
  }

  const changeAccess = (nextAccess: FileDownloadAccess, nextMemberCriteriaIds: string[]) => {
    set({ saved: false });
    if (!enabled || targetStale || !persistedPolicy) {
      return;
    }
    const memberCriteriaIds = nextAccess === 'restricted' ? nextMemberCriteriaIds : [];
    configuration.edit({ access: nextAccess, memberCriteriaIds });
    pendingSave = {
      generation: saveGeneration,
      sequence: ++saveSequence,
      observedPolicy: {
        access: persistedPolicy.access,
        memberCriteriaIds: persistedPolicy.memberCriteria.map((criteria) => criteria.id).sort(),
      },
      access: nextAccess,
      memberCriteriaIds,
      retryCount: 0,
    };
    set({ error: null, saving: true });
    scheduleSaveFlush();
  };

  return {
    api,
    target,
    document,
    enabled,
    start,
    stop,
    changeAccess,
    searchCriteriaList,
    notifyPeerChange,
    captureOwnChange: configuration.captureOwnChange,
    hasUnsavedChanges: () => Boolean(pendingSave || activeSave),
  };
}
