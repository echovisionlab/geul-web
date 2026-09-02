import '@mantine/core/styles.css';
import '@mantine/carousel/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/spotlight/styles.css';
import 'katex/dist/katex.min.css';
import 'video.js/dist/video-js.css';
import '@/lib/styles/variables.css';
import '@/lib/styles/font-assignment.css';
import '@/lib/styles/document-content.css';
import '@/lib/styles/print.css';

import React from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { mantineHtmlProps } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { CookieConsentBanner } from '@/features/cookie-consent/CookieConsentBanner';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { GoogleAnalyticsLoader } from '@/features/analytics/GoogleAnalyticsLoader';
import { loadAfterOnboardingGate } from '@/lib/auth/onboarding-redirect';
import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { getMessagesForLocale } from '@/lib/i18n/messages';
import { resolveRequestTimeZone } from '@/lib/i18n/request-time-zone';
import { AppMantineProvider } from '@/lib/providers/AppMantineProvider';
import { LocalePreferenceSync } from '@/lib/providers/LocalePreferenceSync';
import { LocaleProvider } from '@/lib/providers/LocaleProvider';
import { ReactQueryProvider } from '@/lib/providers/ReactQueryProvider';
import { RequestTimeZoneProvider } from '@/lib/providers/RequestTimeZoneProvider';
import { RouteProgressRuntime } from '@/lib/providers/RouteProgressRuntime';
import { SessionProvider } from '@/lib/providers/SessionProvider';
import { getServerPublicRuntimeConfig } from '@/lib/public-runtime-config';
import { getManifest } from '@/lib/queries/manifest';
import { getSiteMetadataDocument } from '@/lib/queries/metadata';
import { toSessionData } from '@/lib/session-data';
import { buildFontStylesheetHref } from '@/lib/styles/font-stylesheet';
import {
  buildInitialColorSchemeScript,
  COLOR_SCHEME_STORAGE_KEY,
  normalizeColorScheme,
  resolveInitialHtmlColorScheme,
} from '@/lib/theme/color-scheme';
import { siteBrandStyle } from '@/lib/theme/site-brand';
import { toCdnUrl } from '@/lib/utils/file-url';
import { buildSiteOrganizationJsonLd, buildSiteWebSiteJsonLd } from '@/lib/utils/json-ld';
import { getRequestHeaders } from '@/lib/utils/header.server';
import { getRequestLocaleContext } from '@/lib/utils/language.server';
import { getRequestPathnameFromHeaders, getRequestPathWithSearchFromHeaders } from '@/lib/utils/request-path';
import { getSession } from '@/lib/utils/session.server';
import { buildSiteApplicationMetadata, normalizeSiteApplicationTitle } from '@/lib/utils/site-application-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const [localeContext, headersList] = await Promise.all([getRequestLocaleContext(), getRequestHeaders()]);
  const gated = await loadAfterOnboardingGate({
    pathname: getRequestPathnameFromHeaders(headersList, '/'),
    pathWithSearch: getRequestPathWithSearchFromHeaders(headersList, '/'),
    loadSession: getSession,
    loadBootstrap: () =>
      Promise.all([
        getManifest({ requestedLocale: localeContext.locale }),
        getSiteMetadataDocument({ requestedLocale: localeContext.locale }),
      ]),
  });
  if (gated.kind === 'redirect') {
    return {};
  }
  const [manifest, site] = gated.bootstrap;
  const settings = manifest.settings;

  const title = normalizeSiteApplicationTitle(settings.site_title);
  const description = settings.meta_description?.trim() || 'Geul';

  const siteOgImageUrl = settings.site_og_image_url ?? undefined;
  const applicationMetadata = buildSiteApplicationMetadata({
    title,
    faviconAssetSet: settings.favicon_asset_set,
    legacyFaviconUrl: settings.favicon_url ? toCdnUrl(settings.favicon_url) : null,
  });

  return {
    ...applicationMetadata,
    metadataBase: new URL(site.canonicalOrigin),
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description,
    alternates: {
      canonical: '/',
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: site.canonicalOrigin,
      siteName: title,
      images: siteOgImageUrl ? [{ url: siteOgImageUrl, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: siteOgImageUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      images: siteOgImageUrl ? [siteOgImageUrl] : undefined,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [localeContext, headersList] = await Promise.all([getRequestLocaleContext(), getRequestHeaders()]);
  const pathname = getRequestPathnameFromHeaders(headersList, '/');
  const gated = await loadAfterOnboardingGate({
    pathname,
    pathWithSearch: getRequestPathWithSearchFromHeaders(headersList, '/'),
    loadSession: getSession,
    loadBootstrap: () =>
      Promise.all([
        getManifest({ requestedLocale: localeContext.locale }),
        getSiteMetadataDocument({ requestedLocale: localeContext.locale }),
        cookies(),
      ]),
  });
  if (gated.kind === 'redirect') {
    redirect(gated.redirectHref);
  }
  const session = gated.session;
  const [manifest, site, cookieStore] = gated.bootstrap;
  const messages = await getMessagesForLocale(localeContext.locale);
  const publicRuntimeConfig = getServerPublicRuntimeConfig();
  const google_analytics_id = manifest.settings.google_analytics_id;
  const siteJsonLd = [buildSiteOrganizationJsonLd(site), buildSiteWebSiteJsonLd(site)];
  const cookieColorScheme = normalizeColorScheme(cookieStore.get(COLOR_SCHEME_STORAGE_KEY)?.value);
  const initialColorScheme = cookieColorScheme ?? 'auto';
  const initialHtmlColorScheme = resolveInitialHtmlColorScheme(initialColorScheme);
  const initialSession = session ? toSessionData(session) : null;
  const requestTimeZone = resolveRequestTimeZone(session?.geo?.timeZone);
  const { ['data-mantine-color-scheme']: _ignoredMantineColorScheme, ...htmlProps } = mantineHtmlProps;

  return (
    <html
      {...htmlProps}
      lang={localeContext.locale}
      dir={localeContext.definition.dir}
      data-mantine-color-scheme={initialHtmlColorScheme}
      data-font-profile={localeContext.definition.fontProfile}
      data-geul-cdn-url={publicRuntimeConfig.cdnUrl}
      data-geul-api-url={publicRuntimeConfig.apiUrl}
      data-geul-p5-runner-url={publicRuntimeConfig.p5RunnerUrl}
      data-geul-google-maps-api-key={publicRuntimeConfig.googleMapsApiKey}
      data-geul-editor-image-max-size-bytes={publicRuntimeConfig.editorImageMaxSizeBytes}
      data-geul-auth-code-lifespan-seconds={publicRuntimeConfig.authCodeLifespanSeconds}
      data-geul-auth-code-resend-cooldown-seconds={publicRuntimeConfig.authCodeResendCooldownSeconds}
      style={siteBrandStyle(manifest.settings.primary_color)}
    >
      <head>
        <script
          data-geul-color-scheme-script
          dangerouslySetInnerHTML={{ __html: buildInitialColorSchemeScript(cookieColorScheme) }}
        />
        <link rel="preconnect" href={publicRuntimeConfig.cdnUrl} crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href={buildFontStylesheetHref(publicRuntimeConfig.cdnUrl, localeContext.definition.fontProfile)}
        />
        {site.logoUrl ? <meta property="og:logo" content={site.logoUrl} /> : null}
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1a1b1e" media="(prefers-color-scheme: dark)" />
        <meta name="format-detection" content="telephone=no" />
        <JsonLdScript data={siteJsonLd} />
      </head>
      <body>
        <GoogleAnalyticsLoader googleAnalyticsId={google_analytics_id} />
        <ReactQueryProvider>
          <SessionProvider initialData={initialSession}>
            <NextIntlClientProvider
              key={localeContext.locale}
              locale={localeContext.locale}
              messages={messages}
              timeZone={requestTimeZone}
            >
              <RequestTimeZoneProvider timeZone={requestTimeZone}>
                <LocaleProvider locale={localeContext.locale}>
                  <LocalePreferenceSync />
                  <ManifestProvider manifest={manifest}>
                    <AppMantineProvider defaultColorScheme={initialColorScheme}>
                      <RouteProgressRuntime />
                      <ModalsProvider>
                        <Notifications pauseResetOnHover="notification" />
                        {children}
                        <CookieConsentBanner />
                      </ModalsProvider>
                    </AppMantineProvider>
                  </ManifestProvider>
                </LocaleProvider>
              </RequestTimeZoneProvider>
            </NextIntlClientProvider>
          </SessionProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
