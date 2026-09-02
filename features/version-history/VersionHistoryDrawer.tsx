'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { listVersionsRequest, restoreVersionRequest } from '@/lib/client/version-history';
import { useLocale } from '@/lib/providers/LocaleProvider';
import type { VersionContributor, VersionedEntityType, VersionInfo } from '@/lib/types/version-history';
import { formatRelativeTime } from '@/lib/utils/formatDate';
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
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<VersionInfo | null>(null);
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);
  const restoreAvailable = canRestore && Boolean(currentSourceLocale);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listVersionsRequest(entityType, entityId);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      setVersions(result.versions ?? []);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    if (opened) {
      void fetchVersions();
    }
  }, [opened, fetchVersions]);

  const handleRestore = async () => {
    if (!restoreAvailable || !selectedVersion) {
      return;
    }
    setRestoring(true);
    try {
      const result = await restoreVersionRequest(entityType, entityId, selectedVersion.id);
      if (result.error) {
        notifications.show({ message: getBoundedVersionHistoryError(result.error, t('restoreFailed')), color: 'red' });
        return;
      }
      await onRestored?.();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['entity-translations', entityType, entityId] }),
        queryClient.invalidateQueries({ queryKey: ['entity-translation-jobs', entityType, entityId] }),
      ]);
      router.refresh();
      notifications.show({
        message: t('restored', { version: selectedVersion.version }),
        color: 'green',
      });
      closeConfirm();
      onClose();
    } catch {
      notifications.show({ message: t('restoreFailed'), color: 'red' });
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
      sourceLocaleLabel: `${tCommonLabels('locale')}: ${version.sourceLocale}`,
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
            selectedLocale: selectedVersion.sourceLocale,
            currentLocale: currentSourceLocale,
          })
        : t('restoreSameLocaleBody', {
            version: selectedVersion?.version ?? '',
            locale: selectedVersion?.sourceLocale ?? currentSourceLocale ?? '',
          }),
    cancel: tActions('cancel'),
  };

  return (
    <VersionHistoryDrawerView
      opened={opened}
      onClose={onClose}
      versions={versionItems}
      labels={labels}
      loading={loading}
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
