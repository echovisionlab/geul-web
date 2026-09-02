'use client';

import { useTranslations } from 'next-intl';
import { SharePasswordForm } from '@/features/share/SharePasswordForm';
import { accessPageShareAction, type PageShareAccessState } from './page-share-access';

export function PageShareViewClient({
  token,
  idOrSlug,
  requestedLocale,
  initialState,
}: {
  token: string;
  idOrSlug: string;
  requestedLocale: string;
  initialState: PageShareAccessState;
}) {
  const t = useTranslations('pageShareAccess');
  return (
    <SharePasswordForm<NonNullable<PageShareAccessState['error']>>
      action={accessPageShareAction}
      initialState={initialState}
      hiddenFields={{ token, idOrSlug, requestedLocale }}
      getErrorMessage={(error) => t(`errors.${error}`)}
      labels={{ title: t('title'), description: t('description'), password: t('password'), submit: t('submit') }}
    />
  );
}
