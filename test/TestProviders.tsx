import type { PropsWithChildren } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { MantineProvider } from '@mantine/core';
import enMessages from '@/messages/en.json';
import { theme } from '@/theme';

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

interface TestProvidersProps extends PropsWithChildren {
  locale?: string;
  messages?: typeof enMessages;
}

export function TestProviders({ children, locale = 'en', messages = enMessages }: TestProvidersProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <MantineProvider theme={theme}>{children}</MantineProvider>
    </NextIntlClientProvider>
  );
}
