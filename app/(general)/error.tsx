'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { ApplicationErrorPage } from '@/features/application-error/ApplicationErrorPage';
import { resolveErrorStatus } from '@/features/application-error/error-status';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { reportClientRenderFailure } from '@/lib/observability/client-render-failure';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GeneralError({ error, reset }: Props) {
  const locale = normalizeLocale(useLocale()) ?? DEFAULT_LOCALE;
  useEffect(() => {
    reportClientRenderFailure('general', error);
  }, [error]);
  return <ApplicationErrorPage status={resolveErrorStatus(error)} locale={locale} homeHref="/" onRetry={reset} />;
}
