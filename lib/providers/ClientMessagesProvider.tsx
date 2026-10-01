'use client';

import { Suspense, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { MantineProvider } from '@mantine/core';
import { PageLoaderView } from '@/components/core/LoadingSurface';
import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from '@/lib/i18n/locale';
import { isReducedCatalogueRoute, type ClientMessages } from '@/lib/i18n/client-messages';
import { loadClientMessagesForLocale } from '@/lib/i18n/client-message-loaders';

type NextIntlProviderProps = ComponentProps<typeof NextIntlClientProvider>;
type ProviderOptions = Omit<NextIntlProviderProps, 'children' | 'locale' | 'messages'>;

export interface ClientMessagesProviderProps extends ProviderOptions {
  locale: string;
  messages?: Partial<ClientMessages>;
  reducedCatalogue: boolean;
  children: ReactNode;
}

interface IntlBoundaryProps {
  locale: string;
  messages?: Partial<ClientMessages>;
  options: ProviderOptions;
  children: ReactNode;
}

function IntlBoundary({ locale, messages, options, children }: IntlBoundaryProps) {
  return (
    <NextIntlClientProvider
      {...options}
      key={locale}
      locale={locale}
      messages={messages as NextIntlProviderProps['messages']}
    >
      {children}
    </NextIntlClientProvider>
  );
}

function CatalogueLoadingFallback() {
  const t = useTranslations('common.states');
  const loadingMessage = t('loading');

  return (
    <div role="status" aria-label="Loading">
      <MantineProvider>
        <PageLoaderView height="100dvh" minHeight={0} message={loadingMessage} imageAlt={loadingMessage} />
      </MantineProvider>
    </div>
  );
}

function CatalogueLoadError({ onRetry }: { onRetry: () => void }) {
  const tErrors = useTranslations('common.errors');
  const tActions = useTranslations('common.actions');

  return (
    <div role="alert">
      <p>{tErrors('generic')}</p>
      <button type="button" onClick={onRetry}>
        {tActions('tryAgain')}
      </button>
    </div>
  );
}

function ClientMessagesProviderContent({
  locale: requestedLocale,
  messages,
  reducedCatalogue,
  children,
  ...options
}: ClientMessagesProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? '';
  const pathWithSearch = pathname ? `${pathname}${search ? `?${search}` : ''}` : '';
  const locale = requestedLocale || DEFAULT_LOCALE;
  const supportedLocale = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  const requiresFullCatalogue = reducedCatalogue && !isReducedCatalogueRoute(pathWithSearch);

  const [fullCatalogues, setFullCatalogues] = useState<Partial<Record<SupportedLocale, ClientMessages>>>({});
  const [failedLocales, setFailedLocales] = useState<Partial<Record<SupportedLocale, boolean>>>({});
  const [retryTokens, setRetryTokens] = useState<Partial<Record<SupportedLocale, number>>>({});
  const fullMessages = fullCatalogues[supportedLocale];
  const retryToken = retryTokens[supportedLocale] ?? 0;
  const failed = Boolean(failedLocales[supportedLocale]);

  useEffect(() => {
    if (!requiresFullCatalogue || fullMessages) {
      return;
    }

    let active = true;
    setFailedLocales((current) => (current[supportedLocale] ? { ...current, [supportedLocale]: false } : current));
    void loadClientMessagesForLocale(supportedLocale).then(
      (loadedMessages) => {
        if (!active) {
          return;
        }
        setFullCatalogues((current) => ({ ...current, [supportedLocale]: loadedMessages }));
      },
      () => {
        if (!active) {
          return;
        }
        setFailedLocales((current) => ({ ...current, [supportedLocale]: true }));
      },
    );

    return () => {
      active = false;
    };
  }, [fullMessages, requiresFullCatalogue, retryToken, supportedLocale]);

  const retry = () => {
    setFailedLocales((current) => ({ ...current, [supportedLocale]: false }));
    setRetryTokens((current) => ({ ...current, [supportedLocale]: (current[supportedLocale] ?? 0) + 1 }));
  };

  const selectedMessages = !reducedCatalogue && messages ? messages : (fullMessages ?? messages);
  let content = children;
  if (requiresFullCatalogue && !fullMessages) {
    content = failed ? <CatalogueLoadError onRetry={retry} /> : <CatalogueLoadingFallback />;
  }

  return (
    <IntlBoundary locale={locale} messages={selectedMessages} options={options}>
      {content}
    </IntlBoundary>
  );
}

export function ClientMessagesProvider(props: ClientMessagesProviderProps) {
  const { locale, messages, reducedCatalogue, children, ...options } = props;

  return (
    <Suspense
      fallback={
        <IntlBoundary locale={locale} messages={messages} options={options}>
          <CatalogueLoadingFallback />
        </IntlBoundary>
      }
    >
      <ClientMessagesProviderContent
        locale={locale}
        messages={messages}
        reducedCatalogue={reducedCatalogue}
        {...options}
      >
        {children}
      </ClientMessagesProviderContent>
    </Suspense>
  );
}
