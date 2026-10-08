'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorPageView } from '@/components/core/ErrorPage/ErrorPageView';
import { reportClientRenderFailure } from '@/lib/observability/client-render-failure';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GeneralError({ error, reset }: Props) {
  const t = useTranslations('generalError');
  const tCommonActions = useTranslations('common.actions');
  useEffect(() => {
    reportClientRenderFailure('general', error);
  }, [error]);

  return (
    <ErrorPageView
      title={t('title')}
      description={t('description')}
      homeLabel={t('actions.goHome')}
      homeHref="/"
      retryLabel={tCommonActions('tryAgain')}
      onRetry={reset}
    />
  );
}
