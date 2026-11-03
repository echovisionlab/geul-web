'use client';
import { SupportingText, Text as DsText, VisuallyHidden } from '@/components/core/Typography';
import { ConfirmationDialog } from '@/features/confirmation/ui/ConfirmationDialog';

import {
  LayoutInline as DsLayoutInline,
  LayoutStack as DsLayoutStack,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import { NearEndLoader } from '@/components/core/Display';
import { Button } from '@/components/core/Button';
import { Drawer } from '@/components/core/Drawer';
import { Alert } from '@/components/core/Alert';

import { useId, type ReactNode } from 'react';

export interface VersionHistoryItemViewModel {
  id: string;
  version: number;
  versionLabel: string;
  title: string;
  sourceLocaleLabel: string;
  createdAt: string;
  createdAtLabel: string;
  createdAtTooltip?: string;
  contributorLabel: string;
}

export interface VersionHistoryDrawerViewLabels {
  title: string;
  close: string;
  loading: string;
  empty: string;
  restore: string;
  restoreTitle: string;
  restoreBody: string;
  cancel: string;
  loadMore: string;
  loadFailed: string;
  end: string;
  retry: string;
}

export interface VersionHistoryDrawerViewProps {
  opened: boolean;
  onClose: () => void;
  versions: readonly VersionHistoryItemViewModel[];
  labels: VersionHistoryDrawerViewLabels;
  loading: boolean;
  loadingSurface: ReactNode;
  retrying?: boolean;
  error: string | null;
  onRetry: () => Promise<void>;
  pagination: {
    contextKey: string;
    nextPage: number | null;
    loading: boolean;
    error: string | null;
    onLoad: () => Promise<void>;
  };
  restoring: boolean;
  canRestore: boolean;
  selectedVersionId: string | null;
  restoreConfirmationOpened: boolean;
  onSelectVersion: (versionId: string) => void;
  onCloseRestoreConfirmation: () => void;
  onRestore: () => void;
}

export function VersionHistoryDrawerView({
  opened,
  onClose,
  versions,
  labels,
  loading,
  loadingSurface,
  retrying = false,
  error,
  onRetry,
  pagination,
  restoring,
  canRestore,
  selectedVersionId,
  restoreConfirmationOpened,
  onSelectVersion,
  onCloseRestoreConfirmation,
  onRestore,
}: VersionHistoryDrawerViewProps) {
  const historyId = useId();
  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        placement="right"
        size="compact"
        density="compact"
        closeLabel={labels.close}
        title={labels.title}
      >
        <DsLayoutStack gap="sm">
          {loading ? (
            loadingSurface
          ) : error && versions.length === 0 ? (
            <Alert tone="danger" title={error}>
              <Button onClick={onRetry} loading={retrying} size="compact">
                {labels.retry}
              </Button>
            </Alert>
          ) : versions.length === 0 ? (
            <DsLayoutInset block="xl">
              <SupportingText tone="secondary" align="center">
                {labels.empty}
              </SupportingText>
            </DsLayoutInset>
          ) : (
            <>
              <DsLayoutStack gap="sm" role="list" aria-label={labels.title}>
                {versions.map((version) => (
                  <DsLayoutInline
                    key={version.id}
                    gap="xs"
                    align="start"
                    wrap="nowrap"
                    role="listitem"
                    aria-labelledby={`${historyId}-${version.id}-title ${historyId}-${version.id}`}
                  >
                    <DsLayoutStack gap="xxs" flexible shrink>
                      <DsText id={`${historyId}-${version.id}-title`} size="sm" weight="strong" lines={1}>
                        {version.title}
                      </DsText>
                      <DsLayoutInline gap="xs" wrap="wrap">
                        <DsText id={`${historyId}-${version.id}`} size="xs" tone="secondary">
                          {version.versionLabel}
                        </DsText>
                        <DsText id={`${historyId}-${version.id}-locale`} size="xs" tone="secondary">
                          {version.sourceLocaleLabel}
                        </DsText>
                        <DsText as="span" size="xs" tone="secondary" title={version.createdAtTooltip}>
                          <time
                            dateTime={version.createdAt}
                            aria-describedby={version.createdAtTooltip ? `${historyId}-${version.id}-time` : undefined}
                          >
                            {version.createdAtLabel}
                          </time>
                          {version.createdAtTooltip ? (
                            <VisuallyHidden id={`${historyId}-${version.id}-time`}>
                              {version.createdAtTooltip}
                            </VisuallyHidden>
                          ) : null}
                        </DsText>
                      </DsLayoutInline>
                      <DsText size="xs" tone="secondary">
                        {version.contributorLabel}
                      </DsText>
                    </DsLayoutStack>
                    <Button
                      emphasis="medium"
                      size="xs"
                      onClick={() => onSelectVersion(version.id)}
                      disabled={!canRestore}
                      aria-describedby={[
                        `${historyId}-${version.id}`,
                        `${historyId}-${version.id}-title`,
                        `${historyId}-${version.id}-locale`,
                        ...(version.createdAtTooltip ? [`${historyId}-${version.id}-time`] : []),
                      ].join(' ')}
                    >
                      {labels.restore}
                    </Button>
                  </DsLayoutInline>
                ))}
              </DsLayoutStack>
              <NearEndLoader
                pageKey={pagination.nextPage === null ? null : String(pagination.nextPage)}
                resetKey={pagination.contextKey}
                loading={pagination.loading}
                error={pagination.error}
                onLoad={pagination.onLoad}
                labels={{
                  load: labels.loadMore,
                  loading: labels.loading,
                  end: labels.end,
                  retry: labels.retry,
                  failed: labels.loadFailed,
                }}
              />
            </>
          )}
        </DsLayoutStack>
      </Drawer>

      <ConfirmationDialog
        intent="restore"
        opened={restoreConfirmationOpened}
        onClose={onCloseRestoreConfirmation}
        onConfirm={onRestore}
        title={labels.restoreTitle}
        message={labels.restoreBody}
        confirmLabel={labels.restore}
        cancelLabel={labels.cancel}
        closeLabel={labels.close}
        loading={restoring}
        confirmDisabled={!canRestore || !selectedVersionId}
        centered
        size="compact"
      />
    </>
  );
}
