'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useDisclosure, useMounted } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { useShareLinks } from '@/lib/hooks/useShareLinks';
import {
  EXPIRATION_PRESETS,
  type ExpirationPreset,
  type ShareEntityType,
  type ShareLink,
} from '@/lib/types/share-link/model';
import {
  ShareLinkSectionView,
  type ShareLinkBadgeViewModel,
  type ShareLinkItemViewModel,
  type ShareLinkSectionViewLabels,
} from './ui/ShareLinkSectionView';

export interface ShareLinkSectionProps<T extends ShareEntityType> {
  entityType: T;
  entityId: string;
  title?: string;
  description?: string;
  disabled?: boolean;
  maxVisibleLinks?: number;
  initialData?: ShareLink<T>[];
}

function getExpiresAtFromPreset(preset: ExpirationPreset, customDateTimestamp: number | null) {
  if (preset === 'custom') {
    return customDateTimestamp === null ? undefined : new Date(customDateTimestamp);
  }
  const presetConfig = EXPIRATION_PRESETS[preset];
  const date = new Date();
  date.setHours(date.getHours() + presetConfig.hours);
  return date;
}

function normalizeShareUrl(rawUrl: string): string | null {
  if (!rawUrl) {
    return null;
  }
  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }
  if (rawUrl.startsWith('//')) {
    return `https:${rawUrl}`;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[:/]|$)/i.test(rawUrl)) {
    return `https://${rawUrl}`;
  }
  return rawUrl;
}

export function ShareLinkSection<T extends ShareEntityType>({
  entityType,
  entityId,
  title,
  description,
  disabled,
  maxVisibleLinks = 5,
  initialData,
}: ShareLinkSectionProps<T>) {
  const locale = useLocale();
  const t = useTranslations('shareLinks');
  const tActions = useTranslations('common.actions');
  const tMessages = useTranslations('common.messages');
  const tPlaceholders = useTranslations('common.placeholders');
  const hydrated = useMounted();
  const { copy } = useCopyToClipboard();
  const { shareLinks, isLoading, isCreating, isDeleting, create, remove } = useShareLinks({
    entityType,
    entityId,
    initialData,
  });
  const [formOpened, { open: openForm, close: closeForm }] = useDisclosure(false);
  const [label, setLabel] = useState('');
  const [preset, setPreset] = useState<ExpirationPreset>('7d');
  const [customDateTimestamp, setCustomDateTimestamp] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [maxDateTimestamp] = useState(() => Date.now() + 365 * 24 * 60 * 60 * 1000);
  const [showAll, setShowAll] = useState(false);

  const expirationOptions = useMemo(
    () =>
      Object.keys(EXPIRATION_PRESETS).map((key) => ({
        value: key,
        label: t(`presets.${key as ExpirationPreset}`),
      })),
    [locale, t],
  );

  const labels: ShareLinkSectionViewLabels = {
    title: title ?? t('title'),
    newLink: t('newLink'),
    labelOptional: t('labelOptional'),
    labelPlaceholder: t('labelPlaceholder'),
    expiration: t('expiration'),
    expiresAt: t('expiresAt'),
    selectDateAndTime: tPlaceholders('selectDateAndTime'),
    passwordOptional: t('passwordOptional'),
    passwordPlaceholder: t('passwordPlaceholder'),
    passwordProtected: t('policies.passwordProtected'),
    noPassword: t('policies.noPassword'),
    maximumExpiration: t('maximumExpiration'),
    cancel: tActions('cancel'),
    create: t('create'),
    noLinks: t('noLinks'),
    showLess: t('showLess'),
    showMore: t('showMore', { count: Math.max(shareLinks.length - maxVisibleLinks, 0) }),
    copy: tActions('copy'),
    openInNewTab: tActions('openInNewTab'),
    delete: tActions('delete'),
    copyAria: t('copyAria'),
    openAria: t('openAria'),
    deleteAria: t('deleteAria'),
  };

  const linkViewModels = useMemo(
    () =>
      shareLinks.map((link): ShareLinkItemViewModel => {
        const openUrl = normalizeShareUrl(link.url);
        const expired = Boolean(link.expiresAt && link.expiresAt < new Date());
        const badges: ShareLinkBadgeViewModel[] = [];
        badges.push({
          label: link.hasPassword ? t('policies.passwordProtected') : t('policies.noPassword'),
          tone: link.hasPassword ? 'warning' : 'neutral',
        });
        badges.push(getExpirationBadge(link.expiresAt, t));
        return {
          id: link.id,
          label: link.label ?? null,
          displayUrl: openUrl ?? link.url,
          openUrl,
          expired,
          badges,
        };
      }),
    [shareLinks, t],
  );
  const visibleLinks = showAll ? linkViewModels : linkViewModels.slice(0, maxVisibleLinks);

  const handleCreate = async () => {
    try {
      const expiresAt = getExpiresAtFromPreset(preset, customDateTimestamp);
      if (expiresAt && (expiresAt.getTime() <= Date.now() || expiresAt.getTime() > maxDateTimestamp)) {
        notifications.show({ message: t('expirationInvalid'), color: 'red' });
        return;
      }
      await create({
        label: label.trim() || undefined,
        expiresAt,
        password: password.trim() || undefined,
      });
      notifications.show({ message: t('createSuccess'), color: 'green' });
      closeForm();
      setLabel('');
      setPreset('7d');
      setCustomDateTimestamp(null);
      setPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('createError');
      notifications.show({
        message,
        color: 'red',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove(id);
      notifications.show({ message: t('deleteSuccess'), color: 'yellow' });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('deleteError');
      notifications.show({
        message,
        color: 'red',
      });
    }
  };

  const handleCopy = (id: string) => {
    const link = linkViewModels.find((item) => item.id === id);
    if (!link?.openUrl) {
      notifications.show({ message: t('invalidUrl'), color: 'red' });
      return;
    }
    copy(link.openUrl, { successMessage: tMessages('urlCopiedToClipboard') });
  };

  return (
    <ShareLinkSectionView
      labels={labels}
      description={description}
      links={visibleLinks}
      totalLinkCount={shareLinks.length}
      expirationOptions={expirationOptions}
      formOpened={formOpened}
      hydrated={hydrated}
      label={label}
      preset={preset}
      customDateTimestamp={customDateTimestamp}
      maxDateTimestamp={maxDateTimestamp}
      password={password}
      hasMore={shareLinks.length > maxVisibleLinks}
      showAll={showAll}
      isLoading={isLoading}
      isCreating={isCreating}
      deletingLinkId={isDeleting || null}
      disabled={disabled}
      onToggleForm={formOpened ? closeForm : openForm}
      onCloseForm={closeForm}
      onLabelChange={setLabel}
      onPresetChange={(value) => setPreset(value as ExpirationPreset)}
      onCustomDateChange={setCustomDateTimestamp}
      onPasswordChange={setPassword}
      onCreate={handleCreate}
      onCopy={handleCopy}
      onDelete={handleDelete}
      onToggleShowAll={() => setShowAll((current) => !current)}
    />
  );
}

function getExpirationBadge(
  expiresAt: Date,
  t: ReturnType<typeof useTranslations<'shareLinks'>>,
): ShareLinkBadgeViewModel {
  const diff = expiresAt.getTime() - Date.now();
  if (diff <= 0) {
    return { label: t('expirationBadge.expired'), tone: 'danger' };
  }
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return { label: t('expirationBadge.daysLeft', { count: days }), tone: days <= 3 ? 'warning' : 'accent' };
  }
  return { label: t('expirationBadge.hoursLeft', { count: hours }), tone: 'warning' };
}
