import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  AudienceSegmentSummary,
  FileDownloadActionResult,
  FileDownloadAudience,
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
  loadSegments: (
    input: FileDownloadPageInput,
  ) => Promise<FileDownloadActionResult<FileDownloadPage<AudienceSegmentSummary>>>;
  savePolicy: (
    target: FileDownloadPolicyTarget,
    audience: FileDownloadAudience,
    audienceSegmentIds: string[],
    observedPolicy: FileDownloadPolicyObservedState,
    editorOrigin?: string,
  ) => Promise<FileDownloadActionResult<FileDownloadPolicyModel>>;
}

/** The view translates these; `reloadRequired` also means the target now points at another File. */
export type FileDownloadPolicyError = 'loadError' | 'saveError' | 'reloadRequired';

export interface FileDownloadPolicyState {
  audience: FileDownloadAudience;
  audienceSegmentIds: string[];
  /** Audiences the editor can show, merged from the policy, list pages and searches. */
  segments: AudienceSegmentSummary[];
  availableSegmentIds: string[];
  segmentSearch: string;
  segmentsLoadingMore: boolean;
  segmentsLoaded: boolean;
  segmentsLoadFailed: boolean;
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
  /** Loads the policy and the first Audience page. A later start reloads from a clean state. */
  start: (adapter: FileDownloadPolicyEditorAdapter) => void;
  /** Stops in-flight work; a pending change is still written, and its failure is reported. */
  stop: () => void;
  changeAccess: (audience: FileDownloadAudience, audienceSegmentIds: string[]) => void;
  searchSegments: (search: string) => void;
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
  audience: FileDownloadAudience;
  audienceSegmentIds: string[];
  retryCount: number;
}

interface ActivePolicySave {
  token: symbol;
  request: PendingPolicySave;
}

interface ActiveSegmentPagination {
  search: string;
  token: symbol;
  promise: Promise<void>;
}

function mergeSegments(
  current: AudienceSegmentSummary[],
  incoming: AudienceSegmentSummary[],
): AudienceSegmentSummary[] {
  const byId = new Map(current.map((segment) => [segment.id, segment]));
  for (const segment of incoming) {
    byId.set(segment.id, segment);
  }
  return Array.from(byId.values());
}

function mergeIds(current: string[], incoming: AudienceSegmentSummary[]): string[] {
  return Array.from(new Set([...current, ...incoming.map((segment) => segment.id)]));
}

function sortedPolicySegmentIds(policy: FileDownloadPolicyModel): string[] {
  return policy.audienceSegments.map((segment) => segment.id).sort();
}

function applySegmentSelectionDelta(current: string[], observed: string[], desired: string[]): string[] {
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
  const audience = pending.audience === active.audience ? acknowledged.audience : pending.audience;
  const audienceSegmentIds = applySegmentSelectionDelta(
    acknowledged.audienceSegmentIds,
    active.audience === 'restricted' ? active.audienceSegmentIds : [],
    pending.audience === 'restricted' ? pending.audienceSegmentIds : [],
  );
  return {
    ...pending,
    observedPolicy: {
      audience: acknowledged.audience,
      audienceSegmentIds: acknowledged.audienceSegmentIds,
    },
    audience,
    audienceSegmentIds: audience === 'restricted' ? audienceSegmentIds : [],
  };
}

/** After a stale write, the local delta is retried over the freshly read policy. */
function rebasePendingSaveOntoCurrent(pending: PendingPolicySave, current: FileDownloadPolicyModel): PendingPolicySave {
  const currentState = {
    audience: current.audience,
    audienceSegmentIds: sortedPolicySegmentIds(current),
  } satisfies FileDownloadPolicyObservedState;
  const audience = pending.audience === pending.observedPolicy.audience ? currentState.audience : pending.audience;
  const audienceSegmentIds =
    audience === 'restricted'
      ? applySegmentSelectionDelta(
          currentState.audienceSegmentIds,
          pending.observedPolicy.audienceSegmentIds,
          pending.audienceSegmentIds,
        )
      : [];
  return {
    ...pending,
    observedPolicy: currentState,
    audience,
    audienceSegmentIds,
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
 * Loads one File's download policy and saves Audience changes to it. Changes save after a short
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
    { audience: 'disabled', audienceSegmentIds: [] },
    () => {
      const { audience, audienceSegmentIds } = configuration.getConfiguration();
      api.setState({ audience, audienceSegmentIds });
    },
  );
  const api = createStore<FileDownloadPolicyState>()(() => ({
    audience: 'disabled',
    audienceSegmentIds: [],
    segments: [],
    availableSegmentIds: [],
    segmentSearch: '',
    segmentsLoadingMore: false,
    segmentsLoaded: false,
    segmentsLoadFailed: false,
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
  let segmentPaginationGeneration = 0;
  let activeSegmentPagination: ActiveSegmentPagination | null = null;
  let segmentSearchTimer: ReturnType<typeof setTimeout> | null = null;
  const loadedSegmentSearches = new Set<string>();
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
  let persistedPolicy: { audience: FileDownloadAudience; audienceSegments: AudienceSegmentSummary[] } | null = null;

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

  const adoptPolicySegments = (policySegments: AudienceSegmentSummary[]) => {
    set((state) => ({
      segments: mergeSegments(state.segments, policySegments),
      availableSegmentIds: mergeIds(state.availableSegmentIds, policySegments),
    }));
  };

  const refreshPolicyFromPeer = async (): Promise<void> => {
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

      persistedPolicy = { audience: result.data.audience, audienceSegments: result.data.audienceSegments };
      if (
        !configuration.adoptRead(read, {
          audience: result.data.audience,
          audienceSegmentIds: sortedPolicySegmentIds(result.data),
        })
      ) {
        peerRefreshRequested = true;
        return;
      }
      adoptPolicySegments(result.data.audienceSegments);
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

  const clearSegmentSearchTimer = () => {
    if (segmentSearchTimer) {
      clearTimeout(segmentSearchTimer);
      segmentSearchTimer = null;
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
    segmentPaginationGeneration += 1;
    activeSegmentPagination = null;
    loadedSegmentSearches.clear();
    clearSegmentSearchTimer();
    saveGeneration += 1;
    saveSequence += 1;
    clearSaveTimer();
    activeSave = null;

    if (!enabled) {
      configuration.adoptRead(configuration.beginRead(), { audience: 'disabled', audienceSegmentIds: [] });
      set({
        segments: [],
        availableSegmentIds: [],
        segmentSearch: '',
        segmentsLoadingMore: false,
        segmentsLoaded: false,
        segmentsLoadFailed: false,
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
      segmentSearch: '',
      segmentsLoadingMore: false,
      segmentsLoaded: false,
      segmentsLoadFailed: false,
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
      nextAdapter.loadSegments({ page: 1, pageSize: SEGMENTS_PAGE_SIZE }),
    ])
      .then(([policyResult, segmentResult]) => {
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
        const policySegments = policyResult.data.audienceSegments;
        const listedSegments = segmentResult.data?.items ?? [];
        persistedPolicy = { audience: policyResult.data.audience, audienceSegments: policySegments };
        if (
          !configuration.adoptRead(initialRead, {
            audience: policyResult.data.audience,
            audienceSegmentIds: policySegments.map((segment) => segment.id),
          })
        ) {
          peerRefreshRequested = true;
          return;
        }
        set({
          segments: mergeSegments(policySegments, listedSegments),
          availableSegmentIds: mergeIds(
            policySegments.map((segment) => segment.id),
            listedSegments,
          ),
          segmentsLoaded: Boolean(segmentResult.data),
          policyLoaded: true,
          ...(segmentResult.data ? {} : { segmentsLoadFailed: true }),
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
    segmentPaginationGeneration += 1;
    activeSegmentPagination = null;
    clearSegmentSearchTimer();
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
        detachedRequest.audience,
        detachedRequest.audienceSegmentIds,
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

  const loadSegmentsForSearch = (rawSearch: string): Promise<void> => {
    const search = rawSearch.trim();
    if (!search || loadedSegmentSearches.has(search)) {
      return Promise.resolve();
    }

    const generation = ++segmentPaginationGeneration;
    if (activeSegmentPagination?.search === search) {
      return activeSegmentPagination.promise;
    }

    const token = Symbol('file-download-segment-pagination');
    const current = () => segmentPaginationGeneration === generation;
    const promise = Promise.resolve().then(async () => {
      let nextPage = 1;
      let hasMore = true;
      set({ segmentsLoadingMore: true, segmentsLoadFailed: false });

      try {
        while (hasMore) {
          const result = await requireAdapter().loadSegments({ page: nextPage, pageSize: SEGMENTS_PAGE_SIZE, search });
          if (!current()) {
            return;
          }
          if (
            !result.data ||
            result.data.page !== nextPage ||
            (result.data.hasMore && result.data.items.length === 0)
          ) {
            set({ segmentsLoadFailed: true });
            return;
          }
          const items = result.data.items;
          set((state) => ({
            segments: mergeSegments(state.segments, items),
            availableSegmentIds: mergeIds(state.availableSegmentIds, items),
            segmentsLoaded: true,
          }));
          hasMore = result.data.hasMore;
          nextPage = result.data.page + 1;
        }
        if (current()) {
          loadedSegmentSearches.add(search);
        }
      } catch {
        if (current()) {
          set({ segmentsLoadFailed: true });
        }
      } finally {
        if (activeSegmentPagination?.token === token && current()) {
          activeSegmentPagination = null;
          set({ segmentsLoadingMore: false });
        }
      }
    });

    activeSegmentPagination = { search, token, promise };
    return promise;
  };

  const searchSegments = (nextSearch: string) => {
    set({ segmentSearch: nextSearch });
    segmentPaginationGeneration += 1;
    activeSegmentPagination = null;
    clearSegmentSearchTimer();
    if (!nextSearch.trim() || loadedSegmentSearches.has(nextSearch.trim())) {
      set({ segmentsLoadingMore: false });
      return;
    }
    segmentSearchTimer = setTimeout(() => {
      segmentSearchTimer = null;
      void loadSegmentsForSearch(nextSearch);
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
      configuration.discard(['audience', 'audienceSegmentIds']);
      set((state) => ({ segments: mergeSegments(state.segments, persisted.audienceSegments) }));
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
        audience: currentPolicy.audience,
        audienceSegmentIds: sortedPolicySegmentIds(currentPolicy),
      });
      const rebased = rebasePendingSaveOntoCurrent(retryRequest, currentPolicy);
      persistedPolicy = { audience: currentPolicy.audience, audienceSegments: currentPolicy.audienceSegments };
      adoptPolicySegments(currentPolicy.audienceSegments);
      pendingSave = rebased;
      configuration.edit({ audience: rebased.audience, audienceSegmentIds: rebased.audienceSegmentIds });
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
    const write = configuration.beginWrite(['audience', 'audienceSegmentIds']);
    const token = Symbol('file-download-policy-save');
    activeSave = { token, request };
    const saveAdapter = requireAdapter();
    void enqueueFileDownloadPolicyWrite(targetKey, async () => {
      try {
        const result = await saveAdapter.savePolicy(
          target,
          request.audience,
          request.audienceSegmentIds,
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
          audience: result.data.audience,
          audienceSegmentIds: sortedPolicySegmentIds(result.data),
        } satisfies FileDownloadPolicyObservedState;
        write.acknowledge(acknowledgedPolicy);
        persistedPolicy = { audience: result.data.audience, audienceSegments: result.data.audienceSegments };
        adoptPolicySegments(result.data.audienceSegments);
        publishEditorEntityChange(document, write.origin);
        const pending = pendingSave;
        if (pending && pending.generation === request.generation && pending.sequence !== request.sequence) {
          const rebasedPending = rebasePendingSave(pending, request, acknowledgedPolicy);
          pendingSave = rebasedPending;
          configuration.edit({
            audience: rebasedPending.audience,
            audienceSegmentIds: rebasedPending.audienceSegmentIds,
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

  const changeAccess = (nextAudience: FileDownloadAudience, nextAudienceSegmentIds: string[]) => {
    set({ saved: false });
    if (!enabled || targetStale || !persistedPolicy) {
      return;
    }
    const audienceSegmentIds = nextAudience === 'restricted' ? nextAudienceSegmentIds : [];
    configuration.edit({ audience: nextAudience, audienceSegmentIds });
    pendingSave = {
      generation: saveGeneration,
      sequence: ++saveSequence,
      observedPolicy: {
        audience: persistedPolicy.audience,
        audienceSegmentIds: persistedPolicy.audienceSegments.map((segment) => segment.id).sort(),
      },
      audience: nextAudience,
      audienceSegmentIds,
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
    searchSegments,
    notifyPeerChange,
    captureOwnChange: configuration.captureOwnChange,
    hasUnsavedChanges: () => Boolean(pendingSave || activeSave),
  };
}
