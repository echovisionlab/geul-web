import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import type { PropsWithChildren } from 'react';
import { NextIntlClientProvider } from 'next-intl';

import { normalizeLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale';
import enMessages from '@/messages/en.json';

/** UI tests share the native theme host without importing application orchestration into their owner. */
export { DesignSystemProvider as DesignSystemTestProvider } from '@/lib/providers/DesignSystemProvider';

interface TestProvidersProps extends PropsWithChildren {
  locale?: string;
  messages?: typeof enMessages;
}

export function TestProviders({ children, locale = 'en', messages = enMessages }: TestProvidersProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <DesignSystemProvider locale={normalizeLocale(locale) ?? DEFAULT_LOCALE} forceColorScheme="light">
        {children}
      </DesignSystemProvider>
    </NextIntlClientProvider>
  );
}
