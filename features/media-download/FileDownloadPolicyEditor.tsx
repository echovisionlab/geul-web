'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader, Stack } from '@mantine/core';
import { useWindowEvent } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { Alert } from '@/components/core/Alert';
import { StatusBadge } from '@/components/core/Badge';
import { MultiSelect } from '@/components/core/Input';
import type {
  AudienceSegmentSummary,
  FileDownloadActionResult,
  FileDownloadAudience,
  FileDownloadPage,
  FileDownloadPageInput,
  FileDownloadPolicyModel,
  FileDownloadPolicyTarget,
} from '@/lib/types/file-download-access';
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
  ) => Promise<FileDownloadActionResult<FileDownloadPolicyModel>>;
}

interface FileDownloadPolicyEditorProps extends FileDownloadPolicyTarget {
  adapter: FileDownloadPolicyEditorAdapter;
  compact?: boolean;
  presentation?: 'standalone' | 'media-header';
}

const SEGMENTS_PAGE_SIZE = 50;
const SEGMENT_SEARCH_DEBOUNCE_MS = 200;
const POLICY_AUTOSAVE_DEBOUNCE_MS = 250;
const ACCESS_SCOPE_VALUES = {
  disabled: 'scope:disabled',
  public: 'scope:public',
  authenticated: 'scope:authenticated',
  restricted: 'scope:restricted',
} as const;

type AccessScopeValue = (typeof ACCESS_SCOPE_VALUES)[keyof typeof ACCESS_SCOPE_VALUES];

function isAccessScopeValue(value: string): value is AccessScopeValue {
  return Object.values(ACCESS_SCOPE_VALUES).includes(value as AccessScopeValue);
}

interface PendingPolicySave {
  generation: number;
  sequence: number;
  targetKey: string;
  target: FileDownloadPolicyTarget;
  audience: FileDownloadAudience;
  audienceSegmentIds: string[];
}

interface ActivePolicySave {
  token: symbol;
  request: PendingPolicySave;
  promise: Promise<void>;
}

interface ActiveSegmentPagination {
  generation: number;
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

function policyMatchesTarget(policy: FileDownloadPolicyModel, target: FileDownloadPolicyTarget): boolean {
  return (
    policy.entityType === target.entityType &&
    policy.entityId === target.entityId &&
    policy.blockId === target.blockId &&
    policy.referencePath === target.referencePath &&
    policy.fileId === target.expectedFileId
  );
}

export function FileDownloadPolicyEditor({
  entityType,
  entityId,
  blockId,
  referencePath,
  expectedFileId,
  adapter,
  compact = true,
  presentation = 'standalone',
}: FileDownloadPolicyEditorProps) {
  const t = useTranslations('fileDownloadAccess.editor');
  const tReloadRequired = useTranslations('editorCommon.reloadRequired');
  const tActions = useTranslations('common.actions');
  const tStates = useTranslations('common.states');
  const target = useMemo(
    () => ({
      entityType,
      entityId: entityId.trim(),
      blockId: blockId?.trim() || undefined,
      referencePath: referencePath?.trim() || undefined,
      expectedFileId: expectedFileId.trim(),
    }),
    [blockId, entityId, entityType, expectedFileId, referencePath],
  );
  const targetKey = `${target.entityType}:${target.entityId}:${target.blockId ?? ''}:${target.referencePath ?? ''}:${target.expectedFileId}`;
  const enabled = Boolean(target.entityId && target.expectedFileId);
  const [audience, setAudience] = useState<FileDownloadAudience>('disabled');
  const [selectedAudienceSegmentIds, setSelectedAudienceSegmentIds] = useState<string[]>([]);
  const [segments, setSegments] = useState<AudienceSegmentSummary[]>([]);
  const [availableSegmentIds, setAvailableSegmentIds] = useState<string[]>([]);
  const [segmentSearch, setSegmentSearch] = useState('');
  const [segmentsLoadingMore, setSegmentsLoadingMore] = useState(false);
  const [segmentsLoaded, setSegmentsLoaded] = useState(false);
  const [segmentsLoadError, setSegmentsLoadError] = useState('');
  const [loading, setLoading] = useState(enabled);
  const [loadedTargetKey, setLoadedTargetKey] = useState('');
  const [policyLoaded, setPolicyLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const activeTargetKeyRef = useRef(targetKey);
  const segmentPaginationGenerationRef = useRef(0);
  const activeSegmentPaginationRef = useRef<ActiveSegmentPagination | null>(null);
  const segmentSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedSegmentSearchesRef = useRef(new Set<string>());
  const saveGenerationRef = useRef(0);
  const saveSequenceRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<PendingPolicySave | null>(null);
  const activeSaveRef = useRef<ActivePolicySave | null>(null);
  const persistedPolicyRef = useRef<{
    audience: FileDownloadAudience;
    audienceSegments: AudienceSegmentSummary[];
  } | null>(null);
  activeTargetKeyRef.current = targetKey;

  const showDetachedSaveFailure = useCallback(
    (staleTarget: boolean) => {
      notifications.show({
        autoClose: false,
        color: 'red',
        title: t('sectionTitle'),
        message: staleTarget ? tReloadRequired('message') : `${t('saveError')} ${tActions('tryAgain')}`,
      });
    },
    [t, tActions, tReloadRequired],
  );

  useWindowEvent('beforeunload', (event) => {
    if (pendingSaveRef.current || activeSaveRef.current) {
      event.preventDefault();
    }
  });

  useEffect(() => {
    segmentPaginationGenerationRef.current += 1;
    activeSegmentPaginationRef.current = null;
    loadedSegmentSearchesRef.current.clear();
    if (segmentSearchTimerRef.current) {
      clearTimeout(segmentSearchTimerRef.current);
      segmentSearchTimerRef.current = null;
    }
    saveGenerationRef.current += 1;
    saveSequenceRef.current += 1;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    activeSaveRef.current = null;

    if (!enabled) {
      setAudience('disabled');
      setSelectedAudienceSegmentIds([]);
      setSegments([]);
      setAvailableSegmentIds([]);
      setSegmentSearch('');
      setSegmentsLoadingMore(false);
      setSegmentsLoaded(false);
      setSegmentsLoadError('');
      setError('');
      setLoadedTargetKey(targetKey);
      setPolicyLoaded(false);
      setLoading(false);
      persistedPolicyRef.current = null;
      return;
    }

    let cancelled = false;
    setLoading(true);
    setSaving(false);
    setSegmentSearch('');
    setSegmentsLoadingMore(false);
    setSegmentsLoaded(false);
    setSegmentsLoadError('');
    setError('');
    setSaved(false);
    setPolicyLoaded(false);
    Promise.all([
      runAfterFileDownloadPolicyWrites(targetKey, () => adapter.loadPolicy(target)),
      adapter.loadSegments({ page: 1, pageSize: SEGMENTS_PAGE_SIZE }),
    ])
      .then(([policyResult, segmentResult]) => {
        if (cancelled) {
          return;
        }
        if (!policyResult.data) {
          setError(t('loadError'));
          return;
        }
        if (!policyMatchesTarget(policyResult.data, target)) {
          setError(tReloadRequired('message'));
          return;
        }
        const policySegments = policyResult.data.audienceSegments;
        const loadedAudience = policyResult.data.audience;
        const listedSegments = segmentResult.data?.items ?? [];
        persistedPolicyRef.current = {
          audience: loadedAudience,
          audienceSegments: policySegments,
        };
        setAudience(loadedAudience);
        setSelectedAudienceSegmentIds(policySegments.map((segment) => segment.id));
        setSegments(mergeSegments(policySegments, listedSegments));
        setAvailableSegmentIds(
          Array.from(
            new Set([...policySegments.map((segment) => segment.id), ...listedSegments.map((segment) => segment.id)]),
          ),
        );
        setSegmentsLoaded(Boolean(segmentResult.data));
        setPolicyLoaded(true);
        if (!segmentResult.data) {
          setSegmentsLoadError(t('segmentsLoadError'));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('loadError'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadedTargetKey(targetKey);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      segmentPaginationGenerationRef.current += 1;
      activeSegmentPaginationRef.current = null;
      if (segmentSearchTimerRef.current) {
        clearTimeout(segmentSearchTimerRef.current);
        segmentSearchTimerRef.current = null;
      }
      const pendingSave = pendingSaveRef.current;
      saveGenerationRef.current += 1;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      activeSaveRef.current = null;

      if (!pendingSave) {
        pendingSaveRef.current = null;
        return;
      }

      const detachedSave = enqueueFileDownloadPolicyWrite(pendingSave.targetKey, () =>
        adapter.savePolicy(pendingSave.target, pendingSave.audience, pendingSave.audienceSegmentIds),
      );
      pendingSaveRef.current = null;
      void detachedSave
        .then((result) => {
          if (!result.data) {
            showDetachedSaveFailure(result.errorCode === 'staleTarget');
          } else if (!policyMatchesTarget(result.data, pendingSave.target)) {
            showDetachedSaveFailure(true);
          }
        })
        .catch(() => showDetachedSaveFailure(false));
    };
  }, [adapter, enabled, showDetachedSaveFailure, t, target, targetKey, tReloadRequired]);

  const loadSegmentsForSearch = (rawSearch: string) => {
    const search = rawSearch.trim();
    if (!search || loadedSegmentSearchesRef.current.has(search)) {
      return Promise.resolve();
    }

    const generation = ++segmentPaginationGenerationRef.current;
    const activePagination = activeSegmentPaginationRef.current;
    if (activePagination?.search === search) {
      return activePagination.promise;
    }

    const requestTargetKey = targetKey;
    const paginationToken = Symbol('file-download-segment-pagination');
    const paginationPromise = Promise.resolve().then(async () => {
      let nextPage = 1;
      let hasMore = true;
      setSegmentsLoadingMore(true);
      setSegmentsLoadError('');

      try {
        while (hasMore) {
          const result = await adapter.loadSegments({
            page: nextPage,
            pageSize: SEGMENTS_PAGE_SIZE,
            search,
          });
          if (
            activeTargetKeyRef.current !== requestTargetKey ||
            segmentPaginationGenerationRef.current !== generation
          ) {
            return;
          }
          if (!result.data || result.data.page !== nextPage) {
            setSegmentsLoadError(t('segmentsLoadError'));
            return;
          }

          const loadedPage = result.data.page;
          if (result.data.hasMore && result.data.items.length === 0) {
            setSegmentsLoadError(t('segmentsLoadError'));
            return;
          }
          setSegments((current) => mergeSegments(current, result.data!.items));
          setAvailableSegmentIds((current) =>
            Array.from(new Set([...current, ...result.data!.items.map((segment) => segment.id)])),
          );
          setSegmentsLoaded(true);

          hasMore = result.data.hasMore;
          nextPage = loadedPage + 1;
        }

        if (activeTargetKeyRef.current !== requestTargetKey || segmentPaginationGenerationRef.current !== generation) {
          return;
        }
        loadedSegmentSearchesRef.current.add(search);
      } catch {
        if (activeTargetKeyRef.current === requestTargetKey && segmentPaginationGenerationRef.current === generation) {
          setSegmentsLoadError(t('segmentsLoadError'));
        }
      } finally {
        if (
          activeSegmentPaginationRef.current?.token === paginationToken &&
          activeTargetKeyRef.current === requestTargetKey &&
          segmentPaginationGenerationRef.current === generation
        ) {
          activeSegmentPaginationRef.current = null;
          setSegmentsLoadingMore(false);
        }
      }
    });

    activeSegmentPaginationRef.current = {
      generation,
      search,
      token: paginationToken,
      promise: paginationPromise,
    };
    return paginationPromise;
  };

  const scheduleSegmentSearch = (nextSearch: string) => {
    setSegmentSearch(nextSearch);
    segmentPaginationGenerationRef.current += 1;
    activeSegmentPaginationRef.current = null;
    if (segmentSearchTimerRef.current) {
      clearTimeout(segmentSearchTimerRef.current);
      segmentSearchTimerRef.current = null;
    }
    if (!nextSearch.trim() || loadedSegmentSearchesRef.current.has(nextSearch.trim())) {
      setSegmentsLoadingMore(false);
      return;
    }
    segmentSearchTimerRef.current = setTimeout(() => {
      segmentSearchTimerRef.current = null;
      void loadSegmentsForSearch(nextSearch);
    }, SEGMENT_SEARCH_DEBOUNCE_MS);
  };

  function scheduleSaveFlush(delay = POLICY_AUTOSAVE_DEBOUNCE_MS) {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    const scheduledGeneration = saveGenerationRef.current;
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      if (saveGenerationRef.current === scheduledGeneration) {
        void flushPendingSave();
      }
    }, delay);
  }

  function flushPendingSave() {
    const request = pendingSaveRef.current;
    if (
      !request ||
      activeSaveRef.current ||
      request.generation !== saveGenerationRef.current ||
      request.targetKey !== activeTargetKeyRef.current
    ) {
      return;
    }

    pendingSaveRef.current = null;
    const saveToken = Symbol('file-download-policy-save');
    const activeSave: ActivePolicySave = {
      token: saveToken,
      request,
      promise: Promise.resolve(),
    };
    activeSaveRef.current = activeSave;
    activeSave.promise = enqueueFileDownloadPolicyWrite(request.targetKey, async () => {
      try {
        const result = await adapter.savePolicy(request.target, request.audience, request.audienceSegmentIds);
        const detached =
          activeSaveRef.current?.token !== saveToken ||
          request.generation !== saveGenerationRef.current ||
          request.targetKey !== activeTargetKeyRef.current;
        if (detached) {
          if (!result.data) {
            showDetachedSaveFailure(result.errorCode === 'staleTarget');
          } else if (!policyMatchesTarget(result.data, request.target)) {
            showDetachedSaveFailure(true);
          }
          return;
        }
        if (!result.data) {
          if (request.sequence !== saveSequenceRef.current) {
            return;
          }
          const persistedPolicy = persistedPolicyRef.current;
          if (persistedPolicy) {
            setAudience(persistedPolicy.audience);
            setSelectedAudienceSegmentIds(persistedPolicy.audienceSegments.map((segment) => segment.id));
            setSegments((current) => mergeSegments(current, persistedPolicy.audienceSegments));
          }
          setError(result.errorCode === 'staleTarget' ? tReloadRequired('message') : t('saveError'));
          return;
        }
        if (!policyMatchesTarget(result.data, request.target)) {
          setError(tReloadRequired('message'));
          return;
        }
        persistedPolicyRef.current = {
          audience: result.data.audience,
          audienceSegments: result.data.audienceSegments,
        };
        setSegments((current) => mergeSegments(current, result.data!.audienceSegments));
        setAvailableSegmentIds((current) =>
          Array.from(new Set([...current, ...result.data!.audienceSegments.map((segment) => segment.id)])),
        );
        if (request.sequence !== saveSequenceRef.current) {
          return;
        }
        setAudience(result.data.audience);
        setSelectedAudienceSegmentIds(result.data.audienceSegments.map((segment) => segment.id));
        setError('');
        setSaved(true);
      } catch {
        const detached =
          activeSaveRef.current?.token !== saveToken ||
          request.generation !== saveGenerationRef.current ||
          request.targetKey !== activeTargetKeyRef.current;
        if (detached) {
          showDetachedSaveFailure(false);
          return;
        }
        if (
          activeSaveRef.current?.token === saveToken &&
          request.generation === saveGenerationRef.current &&
          request.targetKey === activeTargetKeyRef.current &&
          request.sequence === saveSequenceRef.current
        ) {
          const persistedPolicy = persistedPolicyRef.current;
          if (persistedPolicy) {
            setAudience(persistedPolicy.audience);
            setSelectedAudienceSegmentIds(persistedPolicy.audienceSegments.map((segment) => segment.id));
            setSegments((current) => mergeSegments(current, persistedPolicy.audienceSegments));
          }
          setError(t('saveError'));
        }
      } finally {
        if (activeSaveRef.current?.token === saveToken) {
          activeSaveRef.current = null;
          const pending = pendingSaveRef.current;
          if (
            pending &&
            pending.generation === saveGenerationRef.current &&
            pending.targetKey === activeTargetKeyRef.current
          ) {
            if (!saveTimerRef.current) {
              scheduleSaveFlush(0);
            }
          } else if (
            request.generation === saveGenerationRef.current &&
            request.targetKey === activeTargetKeyRef.current
          ) {
            setSaving(false);
          }
        }
      }
    });
  }

  const queueSave = (nextAudience: FileDownloadAudience, nextAudienceSegmentIds: string[]) => {
    if (!enabled) {
      return;
    }

    const requestSequence = ++saveSequenceRef.current;
    pendingSaveRef.current = {
      generation: saveGenerationRef.current,
      sequence: requestSequence,
      targetKey,
      target,
      audience: nextAudience,
      audienceSegmentIds: nextAudience === 'restricted' ? nextAudienceSegmentIds : [],
    };
    setError('');
    setSaved(false);
    setSaving(true);
    scheduleSaveFlush();
  };
  const loadPending = enabled && (loading || loadedTargetKey !== targetKey);
  const mediaHeader = presentation === 'media-header';
  const resolvedAudience = audience;
  const selectedAccessValues =
    resolvedAudience === 'restricted'
      ? selectedAudienceSegmentIds.length > 0
        ? selectedAudienceSegmentIds
        : [ACCESS_SCOPE_VALUES.restricted]
      : [ACCESS_SCOPE_VALUES[resolvedAudience as Exclude<FileDownloadAudience, 'restricted'>]];
  const accessControl = policyLoaded ? (
    <MultiSelect
      label={mediaHeader ? undefined : t('sectionTitle')}
      aria-label={mediaHeader ? t('sectionTitle') : undefined}
      description={mediaHeader ? undefined : t(`audiences.${resolvedAudience}.description`)}
      value={selectedAccessValues}
      data={[
        { value: ACCESS_SCOPE_VALUES.disabled, label: t('audiences.disabled.label') },
        { value: ACCESS_SCOPE_VALUES.public, label: t('audiences.public.label') },
        { value: ACCESS_SCOPE_VALUES.authenticated, label: t('audiences.authenticated.label') },
        ...(audience === 'restricted' && selectedAudienceSegmentIds.length === 0
          ? [
              {
                value: ACCESS_SCOPE_VALUES.restricted,
                label: t('audiences.restricted.label'),
                disabled: true,
              },
            ]
          : []),
        ...segments.map((segment) => ({
          value: segment.id,
          label: segment.name,
        })),
      ]}
      searchable
      searchValue={segmentSearch}
      onSearchChange={scheduleSegmentSearch}
      collapseSelectedValuesToOneLine
      getCollapsedSummaryLabel={(count) => t('additionalSelected', { count })}
      size="xs"
      w="100%"
      disabled={!enabled || loading}
      rightSection={saving || segmentsLoadingMore ? <Loader size={10} /> : undefined}
      onChange={(values) => {
        const addedValue = values.find((value) => !selectedAccessValues.includes(value));
        if (addedValue && isAccessScopeValue(addedValue)) {
          if (addedValue === ACCESS_SCOPE_VALUES.restricted) {
            return;
          }
          const nextAudience =
            addedValue === ACCESS_SCOPE_VALUES.disabled
              ? 'disabled'
              : addedValue === ACCESS_SCOPE_VALUES.public
                ? 'public'
                : 'authenticated';
          setAudience(nextAudience);
          setSelectedAudienceSegmentIds([]);
          setSaved(false);
          queueSave(nextAudience, []);
          return;
        }

        const nextAudienceSegmentIds = values.filter((value) => !isAccessScopeValue(value));
        if (nextAudienceSegmentIds.length === 0) {
          setAudience('disabled');
          setSelectedAudienceSegmentIds([]);
          setSaved(false);
          queueSave('disabled', []);
          return;
        }

        setAudience('restricted');
        setSelectedAudienceSegmentIds(nextAudienceSegmentIds);
        setSaved(false);
        queueSave('restricted', nextAudienceSegmentIds);
      }}
    />
  ) : null;
  const segmentFeedback = policyLoaded ? (
    <>
      {segmentsLoadingMore ? (
        <StatusBadge
          role="status"
          aria-live="polite"
          size="xs"
          tone="neutral"
          appearance="soft"
          leftSection={<Loader size={8} />}
        >
          {t('loading')}
        </StatusBadge>
      ) : null}
      {segmentsLoadError ? (
        <Alert role="alert" tone="danger">
          {segmentsLoadError}
        </Alert>
      ) : null}
      {segmentsLoaded && availableSegmentIds.length === 0 ? (
        <Alert role="status" aria-live="polite" tone="neutral">
          {t('segmentsEmpty')}
        </Alert>
      ) : null}
      {audience === 'restricted' && selectedAudienceSegmentIds.length === 0 ? (
        <Alert role="alert" tone="warning">
          {t('restrictedWithoutAudience')}
        </Alert>
      ) : null}
    </>
  ) : null;
  const synchronizationFeedback =
    saving || saved ? (
      <Stack align={mediaHeader ? 'flex-start' : 'flex-end'} gap={0} mih={18} aria-live="polite" aria-atomic="true">
        {saving ? (
          <StatusBadge size="xs" tone="neutral" appearance="soft" leftSection={<Loader size={8} />}>
            {tStates('syncing')}
          </StatusBadge>
        ) : null}
        {!saving && saved ? (
          <StatusBadge size="xs" tone="positive" appearance="soft">
            {tStates('synced')}
          </StatusBadge>
        ) : null}
      </Stack>
    ) : null;
  const content = loadPending ? (
    <Alert tone="neutral">{t('loading')}</Alert>
  ) : !enabled ? (
    <Alert tone="neutral">{t('fileRequired')}</Alert>
  ) : !policyLoaded ? (
    error ? (
      <Alert tone="danger">{error}</Alert>
    ) : null
  ) : (
    <>
      {accessControl}
      {segmentFeedback}
      {error ? (
        <Alert role="alert" tone="danger">
          {error}
        </Alert>
      ) : null}
      {synchronizationFeedback}
    </>
  );

  if (mediaHeader) {
    return (
      <Stack
        gap="xs"
        w="100%"
        data-file-download-policy-presentation="media-header"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {loadPending ? <Loader size={16} aria-label={t('loading')} /> : null}
        {!loadPending && policyLoaded ? accessControl : null}
        {!loadPending && policyLoaded ? segmentFeedback : null}
        {!loadPending && policyLoaded && error ? (
          <Alert role="alert" tone="danger">
            {error}
          </Alert>
        ) : null}
        {!loadPending && policyLoaded ? synchronizationFeedback : null}
        {!loadPending && !policyLoaded && error ? (
          <Alert role="alert" tone="danger">
            {error}
          </Alert>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack gap={compact ? 'xs' : 'sm'} data-file-download-policy-presentation="standalone">
      {content}
    </Stack>
  );
}
