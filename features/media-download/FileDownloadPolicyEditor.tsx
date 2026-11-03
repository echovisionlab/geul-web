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
import type { FileDownloadAccess, FileDownloadPolicyTarget } from '@/lib/types/file-download-access';
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
    access,
    memberCriteriaIds: selectedMemberCriteriaIds,
    criteriaList,
    availableCriteriaIds,
    criteriaSearch,
    criteriaListLoadingMore,
    criteriaListLoaded,
    loading,
    policyLoaded,
    saving,
    saved,
    targetStale,
  } = state;
  const enabled = store.enabled;
  const error = state.error === 'reloadRequired' ? tReloadRequired('message') : state.error ? t(state.error) : '';
  const criteriaLoadError = state.criteriaListLoadFailed ? t('criteriaLoadError') : '';
  const loadPending = enabled && loading;
  const blockSettings = presentation === 'block-settings';
  const selectedAccessValues =
    access === 'restricted'
      ? selectedMemberCriteriaIds.length > 0
        ? selectedMemberCriteriaIds
        : [ACCESS_SCOPE_VALUES.restricted]
      : [ACCESS_SCOPE_VALUES[access as Exclude<FileDownloadAccess, 'restricted'>]];
  const accessControl = policyLoaded ? (
    <div style={{ width: '100%' }}>
      <MultiSelect
        label={t('sectionTitle')}
        aria-describedby={error ? errorId : undefined}
        description={t(`access.${access}.description`)}
        value={selectedAccessValues}
        data={[
          { value: ACCESS_SCOPE_VALUES.disabled, label: t('access.disabled.label') },
          { value: ACCESS_SCOPE_VALUES.public, label: t('access.public.label') },
          { value: ACCESS_SCOPE_VALUES.authenticated, label: t('access.authenticated.label') },
          ...(access === 'restricted' && selectedMemberCriteriaIds.length === 0
            ? [
                {
                  value: ACCESS_SCOPE_VALUES.restricted,
                  label: t('access.restricted.label'),
                  disabled: true,
                },
              ]
            : []),
          ...criteriaList.map((criteria) => ({
            value: criteria.id,
            label: criteria.name,
          })),
        ]}
        searchable
        searchValue={criteriaSearch}
        onSearchChange={store.searchCriteriaList}
        collapseSelectedValuesToOneLine
        getCollapsedSummaryLabel={(count) => t('additionalSelected', { count })}
        size="xs"
        disabled={readOnly || !enabled || loading || targetStale}
        rightSection={saving || criteriaListLoadingMore ? <Loader size="xs" /> : undefined}
        onChange={(values) => {
          const change = accessSelectionChange(selectedAccessValues, values);
          if (!change) {
            return;
          }
          if (!readOnly) {
            store.changeAccess(change.access, change.memberCriteriaIds);
          }
        }}
      />
    </div>
  ) : null;
  const criteriaFeedback = policyLoaded ? (
    <>
      {criteriaListLoadingMore ? (
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
      {criteriaLoadError ? (
        <Alert role="alert" tone="danger">
          {criteriaLoadError}
        </Alert>
      ) : null}
      {criteriaListLoaded && availableCriteriaIds.length === 0 ? (
        <Alert role="status" aria-live="polite" tone="neutral">
          {t('criteriaEmpty')}
        </Alert>
      ) : null}
      {access === 'restricted' && selectedMemberCriteriaIds.length === 0 ? (
        <Alert role="alert" tone="warning">
          {t('restrictedWithoutCriteria')}
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
    <PageLoader extent="compact" placement="flow" size="sm" message={t('loading')} />
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
      {criteriaFeedback}
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
        {loadPending ? <PageLoader extent="compact" placement="flow" size="xs" message={t('loading')} /> : null}
        {!loadPending && policyLoaded ? accessControl : null}
        {!loadPending && policyLoaded ? criteriaFeedback : null}
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
