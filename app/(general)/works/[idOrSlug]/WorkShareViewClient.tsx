'use client';

import { useTranslations } from 'next-intl';
import { SharePasswordForm } from '@/features/share/SharePasswordForm';
import { accessWorkShareAction, type WorkShareAccessState } from './work-share-access';

export function WorkShareViewClient({
  token,
  idOrSlug,
  locale,
  requestedLocale,
}: {
  token: string;
  idOrSlug: string;
  locale: string;
  requestedLocale: string;
}) {
  const t = useTranslations('workShareAccess');
  return (
    <SharePasswordForm<NonNullable<WorkShareAccessState['error']>>
      action={accessWorkShareAction}
      initialState={{}}
      hiddenFields={{ token, idOrSlug, locale, requestedLocale }}
      getErrorMessage={(error) => t(`errors.${error}`)}
      labels={{ title: t('title'), description: t('description'), password: t('password'), submit: t('submit') }}
    />
  );
}
