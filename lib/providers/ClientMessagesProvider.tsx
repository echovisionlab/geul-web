'use client';

import { Suspense, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { LayoutContainer, LayoutInset, LayoutStack } from '@/components/core/Layout';
import { PageLoaderView } from '@/components/core/LoadingSurface';
import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from '@/lib/i18n/locale';
import type { ClientMessages } from '@/lib/i18n/client-messages';
import {
  coversClientMessageScope,
  resolveClientMessageScope,
  type ClientMessageCoverage,
} from '@/lib/i18n/client-message-scope';
import { loadClientMessagesForLocale } from '@/lib/i18n/client-message-loaders';
import { useSessionContext } from '@/lib/providers/SessionProvider';

type NextIntlProviderProps = ComponentProps<typeof NextIntlClientProvider>;
type ProviderOptions = Omit<NextIntlProviderProps, 'children' | 'locale' | 'messages'>;

export interface ClientMessagesProviderProps extends ProviderOptions {
  locale: string;
  messages?: Partial<ClientMessages>;
  /**
   * Route scopes whose client components `messages` can serve (`clientMessageCoverage`), or
   * `'all'` for the complete catalogue. Navigation to another scope loads the complete catalogue.
   */
  messageCoverage: ClientMessageCoverage;
  loaderImageSrc?: string | null;
  loaderImageUnoptimized?: boolean;
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

export function CatalogueLoadingFallback({
  loaderImageSrc,
  loaderImageUnoptimized,
}: Pick<ClientMessagesProviderProps, 'loaderImageSrc' | 'loaderImageUnoptimized'>) {
  const t = useTranslations('common.states');
  const loadingMessage = t('loading');

  return (
    <PageLoaderView
      height="100dvh"
      minHeight={0}
      imageSrc={loaderImageSrc}
      imageUnoptimized={loaderImageUnoptimized}
      imageAlt={loadingMessage}
      message={loadingMessage}
    />
  );
}

export function CatalogueLoadError({ onRetry }: { onRetry: () => void }) {
  const tErrors = useTranslations('common.errors');
  const tActions = useTranslations('common.actions');

  return (
    <LayoutContainer size="compact" inset="md">
      <LayoutInset block="xl" inline="none">
        <Alert tone="danger">
          <LayoutStack gap="md" align="start">
            <span>{tErrors('generic')}</span>
            <Button type="button" tone="neutral" emphasis="medium" onClick={onRetry}>
              {tActions('tryAgain')}
            </Button>
          </LayoutStack>
        </Alert>
      </LayoutInset>
    </LayoutContainer>
  );
}

function ClientMessagesProviderContent({
  locale: requestedLocale,
  messages,
  messageCoverage,
  loaderImageSrc,
  loaderImageUnoptimized,
  children,
  ...options
}: ClientMessagesProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? '';
  const pathWithSearch = pathname ? `${pathname}${search ? `?${search}` : ''}` : '';
  const locale = requestedLocale || DEFAULT_LOCALE;
  const supportedLocale = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  const scopedCatalogue = messageCoverage !== 'all';
  const requiresFullCatalogue = !coversClientMessageScope(messageCoverage, resolveClientMessageScope(pathWithSearch));
  // Signed-in users are the ones who move between route groups (editing, /my, /admin). Load the
  // complete catalogue (a cacheable chunk) when the browser is idle so that navigation does not
  // wait for it; anonymous visitors keep the scoped catalogue only.
  const signedIn = Boolean(useSessionContext()?.data);

  const [fullCatalogues, setFullCatalogues] = useState<Partial<Record<SupportedLocale, ClientMessages>>>({});
  const [failedLocales, setFailedLocales] = useState<Partial<Record<SupportedLocale, boolean>>>({});
  const [retryTokens, setRetryTokens] = useState<Partial<Record<SupportedLocale, number>>>({});
  const fullMessages = fullCatalogues[supportedLocale];
  const retryToken = retryTokens[supportedLocale] ?? 0;
  const failed = Boolean(failedLocales[supportedLocale]);

  useEffect(() => {
    if (!scopedCatalogue || !signedIn || requiresFullCatalogue || fullMessages) {
      return;
    }
    let active = true;
    const prefetch = () => {
      void loadClientMessagesForLocale(supportedLocale).then(
        (loadedMessages) => {
          if (active) {
            setFullCatalogues((current) => ({ ...current, [supportedLocale]: loadedMessages }));
          }
        },
        () => undefined, // a later navigation retries with visible error handling
      );
    };
    const idle = typeof window.requestIdleCallback === 'function';
    const handle = idle ? window.requestIdleCallback(prefetch, { timeout: 5000 }) : window.setTimeout(prefetch, 2000);
    return () => {
      active = false;
      if (idle) {
        window.cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle);
      }
    };
  }, [fullMessages, requiresFullCatalogue, scopedCatalogue, signedIn, supportedLocale]);

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

  const selectedMessages = !scopedCatalogue && messages ? messages : (fullMessages ?? messages);
  let content = children;
  if (requiresFullCatalogue && !fullMessages) {
    content = failed ? (
      <CatalogueLoadError onRetry={retry} />
    ) : (
      <CatalogueLoadingFallback loaderImageSrc={loaderImageSrc} loaderImageUnoptimized={loaderImageUnoptimized} />
    );
  }

  return (
    <IntlBoundary locale={locale} messages={selectedMessages} options={options}>
      {content}
    </IntlBoundary>
  );
}

export function ClientMessagesProvider(props: ClientMessagesProviderProps) {
  const { locale, messages, messageCoverage, loaderImageSrc, loaderImageUnoptimized, children, ...options } = props;

  return (
    <Suspense
      fallback={
        <IntlBoundary locale={locale} messages={messages} options={options}>
          <CatalogueLoadingFallback loaderImageSrc={loaderImageSrc} loaderImageUnoptimized={loaderImageUnoptimized} />
        </IntlBoundary>
      }
    >
      <ClientMessagesProviderContent
        locale={locale}
        messages={messages}
        messageCoverage={messageCoverage}
        loaderImageSrc={loaderImageSrc}
        loaderImageUnoptimized={loaderImageUnoptimized}
        {...options}
      >
        {children}
      </ClientMessagesProviderContent>
    </Suspense>
  );
}
