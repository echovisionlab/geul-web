'use client';

import { useTranslations } from 'next-intl';
import { SharePasswordForm } from '@/features/share/SharePasswordForm';
import { accessReleaseShareAction, type ReleaseShareAccessState } from './release-share-access';

export function ReleaseShareViewClient({
  token,
  idOrSlug,
  requestedLocale,
  uiLocale,
}: {
  token: string;
  idOrSlug: string;
  requestedLocale: string;
  uiLocale: string;
}) {
  const t = useTranslations('releaseShareAccess');
  return (
    <SharePasswordForm<NonNullable<ReleaseShareAccessState['error']>>
      action={accessReleaseShareAction}
      initialState={{}}
      hiddenFields={{ token, idOrSlug, requestedLocale, uiLocale }}
      getErrorMessage={(error) => t(`errors.${error}`)}
      labels={{ title: t('title'), description: t('description'), password: t('password'), submit: t('submit') }}
    />
  );
}
