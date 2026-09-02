'use client';

import { useTranslations } from 'next-intl';
import { SharePasswordForm } from '@/features/share/SharePasswordForm';
import { accessLabelShareAction, type LabelShareAccessState } from './label-share-access';

export function LabelShareViewClient({
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
  const t = useTranslations('labelShareAccess');
  return (
    <SharePasswordForm<NonNullable<LabelShareAccessState['error']>>
      action={accessLabelShareAction}
      initialState={{}}
      hiddenFields={{ token, idOrSlug, requestedLocale, uiLocale }}
      getErrorMessage={(error) => t(`errors.${error}`)}
      labels={{ title: t('title'), description: t('description'), password: t('password'), submit: t('submit') }}
    />
  );
}
