'use client';

import { useTranslations } from 'next-intl';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import type { PersonalAccessTokenSettingsLabels } from './ui/PersonalAccessTokenSettings';

export function usePersonalAccessTokenLabels(): PersonalAccessTokenSettingsLabels {
  const { settings } = useSiteSettings();
  const t = useTranslations('security.personalAccessTokens');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  return {
    title: t('title'),
    description: t('description', { siteName: settings.site_title }),
    empty: t('empty'),
    created: tCommonLabels('created'),
    create: tCommonActions('create'),
    regenerate: t('regenerate'),
    delete: tCommonActions('delete'),
    copy: tCommonActions('copy'),
    cancel: tCommonActions('cancel'),
    close: tCommonActions('close'),
    regenerateTitle: t('regenerateTitle'),
    regenerateConfirmation: t('regenerateConfirmation'),
    deleteTitle: t('deleteTitle'),
    deleteConfirmation: t('deleteConfirmation'),
    oneTimeTitle: t('oneTimeTitle'),
    oneTimeWarning: t('oneTimeWarning'),
    secret: t('secret'),
    loadFailed: t('loadFailed'),
  };
}
