'use client';

import { useEffect } from 'react';
import { DEFAULT_LOCALE, getLocaleDirection } from '@/lib/i18n/locale';
import { reportClientRenderFailure } from '@/lib/observability/client-render-failure';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error }: Props) {
  useEffect(() => {
    reportClientRenderFailure('global', error);
  }, [error]);

  return (
    <html lang={DEFAULT_LOCALE} dir={getLocaleDirection(DEFAULT_LOCALE)}>
      <body>
        <h1>Something went wrong</h1>
        <a href="/">Go to homepage</a>
      </body>
    </html>
  );
}
