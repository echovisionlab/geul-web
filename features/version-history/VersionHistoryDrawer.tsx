'use client';

import { formatLocaleCode } from '@/components/core/Typography/locale-code';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { restoreVersionRequest } from '@/lib/client/version-history';
import { useLocale } from '@/lib/providers/LocaleProvider';
import type { VersionContributor, VersionedEntityType, VersionInfo } from '@/lib/types/version-history';
import { formatRelativeTime } from '@/lib/utils/formatDate';
import { useVersionHistoryQuery } from './useVersionHistoryQuery';
import {
  VersionHistoryDrawerView,
  type VersionHistoryDrawerViewLabels,
  type VersionHistoryItemViewModel,
} from './ui/VersionHistoryDrawerView';

export interface VersionHistoryDrawerProps {
  entityType: VersionedEntityType;
  entityId: string;
  opened: boolean;
  onClose: () => void;
  currentSourceLocale: string | null;
  canRestore?: boolean;
  onRestored?: () => Promise<unknown> | unknown;
}

function getBoundedVersionHistoryError(error: unknown, fallback: string): string {
  if (error === 'Unauthorized' || error === 'Forbidden') {
    return error;
  }
  return fallback;
}

export function formatVersionContributors(contributors: readonly VersionContributor[], locale: string): string | null {
  const labels = contributors
    .map((contributor) => contributor.nickname?.trim() || '')
    .filter((label) => label.length > 0);
  return labels.length > 0 ? new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(labels) : null;
}

export function VersionHistoryDrawer({
  entityType,
  entityId,
  opened,
  onClose,
  currentSourceLocale,
  canRestore = true,
  onRestored,
}: VersionHistoryDrawerProps) {
  const t = useTranslations('versionHistory');
  const tActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStates = useTranslations('common.states');
  const locale = useLocale();
  const dateTime = useDateTimeFormatter();
  const router = useRouter();
  const queryClient = useQueryClient();
  const history = useVersionHistoryQuery({ entityType, entityId, opened });
  const versions = history.versions;
  const [restoring, setRestoring] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<VersionInfo | null>(null);
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);
  const restoreAvailable = canRestore && Boolean(currentSourceLocale);

  const loadMore = useCallback(async () => {
    const result = await history.fetchNextPage();
    if (result.isError) {
      throw result.error;
    }
  }, [history.fetchNextPage]);
  const retry = useCallback(async () => {
    await history.refetch();
  }, [history.refetch]);

  const handleRestore = async () => {
    if (!restoreAvailable || !selectedVersion) {
      return;
    }
    setRestoring(true);
    try {
      const result = await restoreVersionRequest(entityType, entityId, selectedVersion.id);
      if (result.error) {
        notifications.show({
          message: getBoundedVersionHistoryError(result.error, t('restoreFailed')),
          tone: 'danger',
        });
        return;
      }
      await onRestored?.();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['version-history', entityType, entityId] }),
        queryClient.invalidateQueries({ queryKey: ['entity-translations', entityType, entityId] }),
        queryClient.invalidateQueries({ queryKey: ['entity-translation-jobs', entityType, entityId] }),
      ]);
      router.refresh();
      notifications.show({
        message: t('restored', { version: selectedVersion.version }),
        tone: 'positive',
      });
      closeConfirm();
      onClose();
    } catch {
      notifications.show({ message: t('restoreFailed'), tone: 'danger' });
    } finally {
      setRestoring(false);
    }
  };

  const handleRestoreClick = (versionId: string) => {
    if (!restoreAvailable) {
      return;
    }
    const version = versions.find((candidate) => candidate.id === versionId);
    if (!version) {
      return;
    }
    setSelectedVersion(version);
    openConfirm();
  };

  const versionItems: VersionHistoryItemViewModel[] = versions.map((version) => {
    const contributorNames = formatVersionContributors(version.contributors, locale);
    return {
      id: version.id,
      version: version.version,
      versionLabel: `v${version.version}`,
      title: version.title || tCommonStates('untitledPlain'),
      sourceLocaleLabel: `${tCommonLabels('locale')}: ${formatLocaleCode(version.sourceLocale)}`,
      createdAt: version.createdAt,
      createdAtLabel: formatRelativeTime(version.createdAt, locale, dateTime.timeZone) ?? tCommonStates('unknown'),
      createdAtTooltip: dateTime.dateTime(version.createdAt),
      contributorLabel: contributorNames ? t('by', { contributors: contributorNames }) : t('systemOrLegacy'),
    };
  });

  const labels: VersionHistoryDrawerViewLabels = {
    title: tCommonLabels('versionHistory'),
    close: tActions('close'),
    loading: tCommonStates('loading'),
    empty: t('empty'),
    restore: t('restore'),
    restoreTitle: t('restoreTitle'),
    restoreBody:
      selectedVersion && currentSourceLocale && selectedVersion.sourceLocale !== currentSourceLocale
        ? t('restoreCrossLocaleBody', {
            version: selectedVersion.version,
            selectedLocale: formatLocaleCode(selectedVersion.sourceLocale),
            currentLocale: formatLocaleCode(currentSourceLocale),
          })
        : t('restoreSameLocaleBody', {
            version: selectedVersion?.version ?? '',
            locale: formatLocaleCode(selectedVersion?.sourceLocale ?? currentSourceLocale ?? ''),
          }),
    cancel: tActions('cancel'),
    loadMore: tActions('continue'),
    loadFailed: t('loadFailed'),
    end: t('end'),
    retry: tActions('tryAgain'),
  };

  return (
    <VersionHistoryDrawerView
      opened={opened}
      onClose={onClose}
      versions={versionItems}
      labels={labels}
      loading={history.isLoading}
      error={history.isError ? labels.loadFailed : null}
      onRetry={retry}
      pagination={{
        contextKey: `${entityType}:${entityId}`,
        nextPage: history.nextPage,
        loading: history.isFetchingNextPage,
        error: history.isError ? labels.loadFailed : null,
        onLoad: loadMore,
      }}
      restoring={restoring}
      canRestore={restoreAvailable}
      selectedVersionId={selectedVersion?.id ?? null}
      restoreConfirmationOpened={confirmOpened}
      onSelectVersion={handleRestoreClick}
      onCloseRestoreConfirmation={closeConfirm}
      onRestore={handleRestore}
    />
  );
}
