import { semanticThemes } from '@echovisionlab/design-system/tokens';
import { OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '@/lib/constants/og-image';
import '@/lib/styles/variables.css';
import '@/lib/styles/font-assignment.css';
import '@/lib/styles/base.css';
import '@/lib/styles/document-content.css';
import '@/lib/styles/print.css';

import React from 'react';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ClientMessagesProvider } from '@/lib/providers/ClientMessagesProvider';
import { resolvePageLoaderImage } from '@/features/site/PageLoader/loader-image';
import { ConfirmDialogHost } from '@/components/core/Modal/confirm-dialogs';
import { AppNotificationRegion } from '@/lib/providers/AppNotificationRegion';
import { ServerSocialLinksDisplay } from '@/features/social-links/ServerSocialLinksDisplay';
import { CookieConsentBanner } from '@/features/cookie-consent/CookieConsentBanner';
import { JsonLdScript } from '@/features/metadata/ui/JsonLdScript';
import { GoogleAnalyticsLoader } from '@/features/analytics/GoogleAnalyticsLoader';
import { loadAfterOnboardingGate } from '@/lib/auth/onboarding-redirect';
import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { getMessagesForLocale } from '@/lib/i18n/messages';
import { clientMessageCoverage, selectClientMessages } from '@/lib/i18n/client-messages';
import { resolveRequestTimeZone } from '@/lib/i18n/request-time-zone';
import { AppDesignSystemProvider } from '@/lib/providers/AppDesignSystemProvider';
import { LocalePreferenceSync } from '@/lib/providers/LocalePreferenceSync';
import { LocaleProvider } from '@/lib/providers/LocaleProvider';
import { RequestTimeZoneProvider } from '@/lib/providers/RequestTimeZoneProvider';
import { RouteProgressRuntime } from '@/lib/providers/RouteProgressRuntime';
import { EditorNavigationProvider } from '@/lib/providers/EditorNavigationProvider';
import { SessionProvider } from '@/lib/providers/SessionProvider';
import { getServerPublicRuntimeConfig } from '@/lib/public-runtime-config.server';
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
};

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
  const description = settings.meta_description?.trim() || title;

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
      images: siteOgImageUrl ? [{ url: siteOgImageUrl, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT }] : undefined,
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
  const fullMessages = await getMessagesForLocale(localeContext.locale);
  const messagesPathWithSearch = getRequestPathWithSearchFromHeaders(headersList, pathname);
  const messages = selectClientMessages(fullMessages, { pathWithSearch: messagesPathWithSearch });
  const publicRuntimeConfig = getServerPublicRuntimeConfig();
  const loaderImage = resolvePageLoaderImage(manifest.settings.loader_urls ?? []);
  const google_analytics_id = manifest.settings.google_analytics_id;
  const siteJsonLd = [buildSiteOrganizationJsonLd(site), buildSiteWebSiteJsonLd(site)];
  const cookieColorScheme = normalizeColorScheme(cookieStore.get(COLOR_SCHEME_STORAGE_KEY)?.value);
  const initialColorScheme = cookieColorScheme ?? 'auto';
  const initialHtmlColorScheme = resolveInitialHtmlColorScheme(initialColorScheme);
  const initialSession = session ? toSessionData(session) : null;
  const requestTimeZone = resolveRequestTimeZone(session?.geo?.timeZone);

  return (
    <html
      suppressHydrationWarning
      lang={localeContext.locale}
      dir={localeContext.definition.dir}
      data-geul-theme={initialHtmlColorScheme}
      data-font-profile={localeContext.definition.fontProfile}
      data-geul-cdn-url={publicRuntimeConfig.cdnUrl}
      data-geul-font-base-url={publicRuntimeConfig.fontBaseUrl}
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
        <link rel="preconnect" href={new URL(publicRuntimeConfig.fontBaseUrl).origin} crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href={buildFontStylesheetHref(publicRuntimeConfig.fontBaseUrl, localeContext.definition.fontProfile)}
        />
        {site.logoUrl ? <meta property="og:logo" content={site.logoUrl} /> : null}
        <meta name="theme-color" content={semanticThemes.light.background} media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content={semanticThemes.dark.background} media="(prefers-color-scheme: dark)" />
        <meta name="format-detection" content="telephone=no" />
        <JsonLdScript data={siteJsonLd} />
      </head>
      <body>
        <GoogleAnalyticsLoader googleAnalyticsId={google_analytics_id} />
        <SessionProvider initialData={initialSession}>
          <AppDesignSystemProvider defaultColorScheme={initialColorScheme} locale={localeContext.locale}>
            <ClientMessagesProvider
              loaderImageSrc={loaderImage.src}
              loaderImageUnoptimized={loaderImage.unoptimized}
              key={localeContext.locale}
              locale={localeContext.locale}
              messages={messages}
              messageCoverage={clientMessageCoverage(messagesPathWithSearch)}
              timeZone={requestTimeZone}
            >
              <RequestTimeZoneProvider timeZone={requestTimeZone}>
                <LocaleProvider locale={localeContext.locale}>
                  <LocalePreferenceSync />
                  <ManifestProvider
                    manifest={manifest}
                    socialLinks={<ServerSocialLinksDisplay links={manifest.settings.social_links} gap="sm" />}
                  >
                    <EditorNavigationProvider>
                      <RouteProgressRuntime />
                      <>
                        <ConfirmDialogHost
                          loadError={{
                            message: fullMessages.common.errors.generic,
                            retryLabel: fullMessages.common.actions.tryAgain,
                          }}
                        />
                        <AppNotificationRegion />
                        {children}
                        <CookieConsentBanner />
                      </>
                    </EditorNavigationProvider>
                  </ManifestProvider>
                </LocaleProvider>
              </RequestTimeZoneProvider>
            </ClientMessagesProvider>
          </AppDesignSystemProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
