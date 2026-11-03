'use client';

import { VisuallyHidden } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { useId } from 'react';
import { useTranslations } from 'next-intl';

import { PageLoader } from '@/features/site/PageLoader';
import { Spinner as Loader } from '@/components/core/Display';
import { notifications } from '@/components/core/Notification';
import { Alert } from '@/components/core/Alert';
import { StatusBadge } from '@/components/core/Badge';
import { MultiSelect } from '@/components/core/Input';
import type { FileDownloadAudience, FileDownloadPolicyTarget } from '@/lib/types/file-download-access';
import { ACCESS_SCOPE_VALUES, accessSelectionChange } from './file-download-policy-state';
import type { FileDownloadPolicyEditorAdapter } from './file-download-policy-store';
import { useFileDownloadPolicyStore } from './useFileDownloadPolicyStore';

export type { FileDownloadPolicyEditorAdapter } from './file-download-policy-store';

interface FileDownloadPolicyEditorProps extends FileDownloadPolicyTarget {
  adapter: FileDownloadPolicyEditorAdapter;
  /** Track policies are metadata of their owning Release. */
  releaseId?: string;
  compact?: boolean;
  readOnly?: boolean;
  presentation?: 'standalone' | 'block-settings';
}

export function FileDownloadPolicyEditor({
  entityType,
  entityId,
  blockId,
  referencePath,
  expectedFileId,
  adapter,
  releaseId,
  compact = true,
  presentation = 'standalone',
  readOnly = false,
}: FileDownloadPolicyEditorProps) {
  const t = useTranslations('fileDownloadAccess.editor');
  const tReloadRequired = useTranslations('editorCommon.reloadRequired');
  const tActions = useTranslations('common.actions');
  const tStates = useTranslations('common.states');
  const errorId = useId();
  const { store, state } = useFileDownloadPolicyStore({
    target: { entityType, entityId, blockId, referencePath, expectedFileId },
    adapter,
    releaseId,
    onDetachedSaveFailure: (staleTarget) =>
      notifications.show({
        autoClose: false,
        tone: 'danger',
        title: t('sectionTitle'),
        message: staleTarget ? tReloadRequired('message') : `${t('saveError')} ${tActions('tryAgain')}`,
      }),
  });
  const {
    audience,
    audienceSegmentIds: selectedAudienceSegmentIds,
    segments,
    availableSegmentIds,
    segmentSearch,
    segmentsLoadingMore,
    segmentsLoaded,
    loading,
    policyLoaded,
    saving,
    saved,
    targetStale,
  } = state;
  const enabled = store.enabled;
  const error = state.error === 'reloadRequired' ? tReloadRequired('message') : state.error ? t(state.error) : '';
  const segmentsLoadError = state.segmentsLoadFailed ? t('segmentsLoadError') : '';
  const loadPending = enabled && loading;
  const blockSettings = presentation === 'block-settings';
  const selectedAccessValues =
    audience === 'restricted'
      ? selectedAudienceSegmentIds.length > 0
        ? selectedAudienceSegmentIds
        : [ACCESS_SCOPE_VALUES.restricted]
      : [ACCESS_SCOPE_VALUES[audience as Exclude<FileDownloadAudience, 'restricted'>]];
  const accessControl = policyLoaded ? (
    <div style={{ width: '100%' }}>
      <MultiSelect
        label={t('sectionTitle')}
        aria-describedby={error ? errorId : undefined}
        description={t(`audiences.${audience}.description`)}
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
        onSearchChange={store.searchSegments}
        collapseSelectedValuesToOneLine
        getCollapsedSummaryLabel={(count) => t('additionalSelected', { count })}
        size="xs"
        disabled={readOnly || !enabled || loading || targetStale}
        rightSection={saving || segmentsLoadingMore ? <Loader size="xs" /> : undefined}
        onChange={(values) => {
          const change = accessSelectionChange(selectedAccessValues, values);
          if (!change) {
            return;
          }
          if (!readOnly) {
            store.changeAccess(change.audience, change.audienceSegmentIds);
          }
        }}
      />
    </div>
  ) : null;
  const segmentFeedback = policyLoaded ? (
    <>
      {segmentsLoadingMore ? (
        <StatusBadge
          role="status"
          aria-live="polite"
          tone="neutral"
          appearance="soft"
          leftSection={<Loader size="xs" />}
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
      <div style={{ minHeight: 18 }}>
        <DsLayoutStack align={blockSettings ? 'start' : 'end'} gap="none">
          {saving ? (
            <StatusBadge tone="neutral" appearance="soft" leftSection={<Loader size="xs" />}>
              {tStates('syncing')}
            </StatusBadge>
          ) : null}
          {!saving && saved ? (
            <StatusBadge tone="positive" appearance="soft">
              {tStates('synced')}
            </StatusBadge>
          ) : null}
        </DsLayoutStack>
      </div>
    ) : null;
  const content = loadPending ? (
    <PageLoader placement="flow" minHeight={120} size="sm" message={t('loading')} />
  ) : !enabled ? (
    <Alert role="status" tone="neutral">
      {t('fileRequired')}
    </Alert>
  ) : !policyLoaded ? (
    error ? (
      <Alert id={errorId} role="alert" tone="danger">
        {error}
      </Alert>
    ) : null
  ) : (
    <>
      {accessControl}
      {segmentFeedback}
      {error ? (
        <Alert id={errorId} role="alert" tone="danger">
          {error}
        </Alert>
      ) : null}
      {synchronizationFeedback}
    </>
  );

  if (blockSettings) {
    return (
      <DsLayoutStack
        gap="xs"
        fill="inline"
        role="group"
        aria-label={t('sectionTitle')}
        aria-busy={loadPending}
        data-file-download-policy-presentation="block-settings"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <VisuallyHidden role="status" aria-live="polite" aria-atomic="true" data-file-download-policy-sync>
          {saving ? tStates('syncing') : saved ? tStates('synced') : ''}
        </VisuallyHidden>
        {loadPending ? <PageLoader placement="flow" minHeight={96} size="xs" message={t('loading')} /> : null}
        {!loadPending && policyLoaded ? accessControl : null}
        {!loadPending && policyLoaded ? segmentFeedback : null}
        {!loadPending && policyLoaded && error ? (
          <Alert id={errorId} role="alert" tone="danger">
            {error}
          </Alert>
        ) : null}
        {!loadPending && policyLoaded ? synchronizationFeedback : null}
        {!loadPending && !policyLoaded && error ? (
          <Alert id={errorId} role="alert" tone="danger">
            {error}
          </Alert>
        ) : null}
      </DsLayoutStack>
    );
  }

  return (
    <DsLayoutStack
      gap={compact ? 'xs' : 'sm'}
      data-file-download-policy-presentation="standalone"
      role="group"
      aria-label={t('sectionTitle')}
      aria-busy={loadPending}
    >
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true" data-file-download-policy-sync>
        {saving ? tStates('syncing') : saved ? tStates('synced') : ''}
      </VisuallyHidden>
      {content}
    </DsLayoutStack>
  );
}
