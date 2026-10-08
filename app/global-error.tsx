'use client';

import '@mantine/core/styles.css';
import '@/lib/styles/variables.css';
import '@/lib/styles/font-assignment.css';

import { useEffect, useSyncExternalStore } from 'react';
import { resolveErrorStatus } from '@/features/application-error/error-status';
import { RootErrorPageView } from '@/features/application-error/RootErrorPageView';
import { DEFAULT_LOCALE, getLocaleDirection, getLocaleFontProfile, normalizeLocale } from '@/lib/i18n/locale';
import { AppMantineProvider } from '@/lib/providers/AppMantineProvider';
import { readLocaleCookie } from '@/lib/i18n/locale-cookie';
import { reportClientRenderFailure } from '@/lib/observability/client-render-failure';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

const subscribe = () => () => {};
function readFallbackLocale() {
  try {
    const cookieLocale = readLocaleCookie(document.cookie);
    if (cookieLocale) {
      return cookieLocale;
    }
  } catch {
    // A malformed or inaccessible preference must not break the fallback itself.
  }
  for (const language of navigator.languages) {
    const locale = normalizeLocale(language);
    if (locale) {
      return locale;
    }
  }
  return DEFAULT_LOCALE;
}

export default function GlobalError({ error, reset }: Props) {
  const locale = useSyncExternalStore(subscribe, readFallbackLocale, () => DEFAULT_LOCALE);
  useEffect(() => {
    reportClientRenderFailure('global', error);
  }, [error]);

  return (
    <html lang={locale} dir={getLocaleDirection(locale)} data-font-profile={getLocaleFontProfile(locale)}>
      <body>
        <AppMantineProvider defaultColorScheme="auto">
          <RootErrorPageView status={resolveErrorStatus(error)} locale={locale} onRetry={reset} />
        </AppMantineProvider>
      </body>
    </html>
  );
}
