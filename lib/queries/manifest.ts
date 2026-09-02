import { isConnectError, isConnectErrorCode } from '@/lib/api/connect-error';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { cache } from 'react';
import type { DocumentLayout } from '@echovisionlab/geul-common/collaboration/document-layout';
import {
  type Menus as ProtoMenus,
  type SiteSettings as ProtoSiteSettings,
} from '@echovisionlab/geul-proto/public/manifest_pb.ts';
import {
  createManifestClient,
  createPublicManifestClient,
  createPublicPageClient,
  createPublicPageClientWithAuth,
} from '@/lib/api/server-client';
import { resolveFeaturedImageDeliveryUrl } from '@/lib/media/post-featured-image';
import { mapProtoDocumentLayout } from '@/lib/queries/document-layout';
import { mapPublicLocalizationInfo, type PublicLocalizationInfoLike } from '@/lib/queries/localized-public';
import type { SocialLinks } from '@/lib/types/common/social-links';
import type { ContentBlockMediaItem } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { materializeLocalizedPageSections, type LocalizedPageSection } from '@/features/editor/contract/localized-page';
import { createLogger } from '@/lib/utils/logger';
import { assetRefUrl, themedAssetRefUrl } from '@/lib/utils/asset-ref';

const logger = createLogger('manifest-queries');

// Manifest settings (converted from proto)
export interface ManifestSettings {
  site_title: string;
  meta_description: string;
  site_origin: string;
  logo_url: string | null;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  favicon_asset_set: FaviconAssetSetUrls | null;
  loader_urls: string[];
  primary_color: string;
  google_analytics_id: string | null;
  site_og_image_url: string | null;
  company_name: string;
  company_address: string;
  tax_id: string;
  legal_email: string;
  support_email: string;
  privacy_email: string;
  social_links: SocialLinks;
  default_comments_enabled: boolean;
}

export interface FaviconAssetSetUrls {
  icon_ico_url: string;
  icon_png_16_url: string;
  icon_png_32_url: string;
  icon_png_48_url: string;
  apple_touch_icon_180_url: string;
  manifest_icon_192_url: string;
  manifest_icon_512_url: string;
  icon_svg_url: string | null;
}

export interface Manifest {
  settings: ManifestSettings;
  menus: ProtoMenus;
}

export interface ManifestSnapshot {
  manifest: Manifest;
  hasSettings: boolean;
}

export interface SiteContext {
  siteName: string;
  canonicalOrigin: string;
}

interface ManifestQueryOptions {
  requestedLocale?: string | null;
}

function normalizeRequestedLocale(requestedLocale: string | null | undefined): string | null {
  return requestedLocale?.trim() || null;
}

// Default manifest for error fallback
const DEFAULT_MANIFEST: Manifest = {
  settings: {
    site_title: '',
    meta_description: '',
    site_origin: '',
    logo_url: null,
    logo_light_url: null,
    logo_dark_url: null,
    favicon_url: null,
    favicon_asset_set: null,
    loader_urls: [],
    primary_color: '#b02d23',
    google_analytics_id: null,
    site_og_image_url: null,
    company_name: '',
    company_address: '',
    tax_id: '',
    legal_email: '',
    support_email: '',
    privacy_email: '',
    social_links: {},
    default_comments_enabled: true,
  },
  menus: {
    $typeName: 'api.open.v1.Menus',
    header: [],
    secondary: [],
    footer: [],
    avatarDropdown: [],
  },
};

function mapFaviconAssetSet(assetSet: ProtoSiteSettings['faviconAssetSet']): FaviconAssetSetUrls | null {
  if (!assetSet) {
    return null;
  }

  const iconIcoUrl = assetRefUrl(assetSet.iconIco);
  const iconPng16Url = assetRefUrl(assetSet.iconPng16);
  const iconPng32Url = assetRefUrl(assetSet.iconPng32);
  const iconPng48Url = assetRefUrl(assetSet.iconPng48);
  const appleTouchIcon180Url = assetRefUrl(assetSet.appleTouchIcon180);
  const manifestIcon192Url = assetRefUrl(assetSet.manifestIcon192);
  const manifestIcon512Url = assetRefUrl(assetSet.manifestIcon512);

  if (
    !iconIcoUrl ||
    !iconPng16Url ||
    !iconPng32Url ||
    !iconPng48Url ||
    !appleTouchIcon180Url ||
    !manifestIcon192Url ||
    !manifestIcon512Url
  ) {
    return null;
  }

  return {
    icon_ico_url: iconIcoUrl,
    icon_png_16_url: iconPng16Url,
    icon_png_32_url: iconPng32Url,
    icon_png_48_url: iconPng48Url,
    apple_touch_icon_180_url: appleTouchIcon180Url,
    manifest_icon_192_url: manifestIcon192Url,
    manifest_icon_512_url: manifestIcon512Url,
    icon_svg_url: assetRefUrl(assetSet.iconSvg),
  };
}

// Convert proto settings to local format
function fromProtoSettings(settings: ProtoSiteSettings | undefined): ManifestSettings {
  if (!settings) {
    return DEFAULT_MANIFEST.settings;
  }
  const loaderUrls = (settings.loaderAssets ?? []).map((asset) => asset.url).filter(Boolean);
  const faviconAssetSet = mapFaviconAssetSet(settings.faviconAssetSet);
  return {
    site_title: settings.siteTitle,
    meta_description: settings.metaDescription,
    site_origin: settings.siteOrigin ?? '',
    logo_url: themedAssetRefUrl(settings.logoLightAsset, settings.logoDarkAsset),
    logo_light_url: settings.logoLightAsset?.url ?? null,
    logo_dark_url: settings.logoDarkAsset?.url ?? null,
    favicon_url: settings.faviconAssetSet
      ? faviconAssetSet
        ? assetRefUrl(settings.faviconAsset)
        : null
      : assetRefUrl(settings.faviconAsset),
    favicon_asset_set: faviconAssetSet,
    loader_urls: loaderUrls,
    primary_color: settings.primaryColor || '#b02d23',
    google_analytics_id: settings.googleAnalyticsId ?? null,
    site_og_image_url: settings.siteOgAsset?.url ?? null,
    company_name: settings.companyName,
    company_address: settings.companyAddress,
    tax_id: settings.taxId,
    legal_email: settings.legalEmail,
    support_email: settings.supportEmail,
    privacy_email: settings.privacyEmail,
    social_links: (settings.socialLinks ?? {}) as SocialLinks,
    default_comments_enabled: settings.defaultCommentsEnabled,
  };
}

function normalizeSiteName(siteTitle: string | null | undefined): string {
  const trimmed = siteTitle?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'Site';
}

function normalizeCanonicalOrigin(siteOrigin: string | null | undefined): string {
  const trimmed = siteOrigin?.trim();
  if (!trimmed) {
    throw new Error('Manifest site_origin is required');
  }
  return trimmed.replace(/\/+$/, '');
}

function toSiteContext(settings: ManifestSettings): SiteContext {
  return {
    siteName: normalizeSiteName(settings.site_title),
    canonicalOrigin: normalizeCanonicalOrigin(settings.site_origin),
  };
}

/**
 * Get site settings only (calls manifest API internally)
 * Use this for pages that only need settings, not menus
 */
export async function getSettings(options?: ManifestQueryOptions): Promise<ManifestSettings> {
  const manifest = await getManifest(options);
  return manifest.settings;
}

export async function getPublicSettings(options?: ManifestQueryOptions): Promise<ManifestSettings> {
  try {
    const client = createPublicManifestClient(options?.requestedLocale);
    const response = await client.get({});
    return fromProtoSettings(response.settings);
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('GetPublicSettings RPC error', { error: err.message });
    }
    return DEFAULT_MANIFEST.settings;
  }
}

export async function getManageSiteContext(): Promise<SiteContext> {
  try {
    const client = await createManifestClient();
    const response = await client.get({});
    return toSiteContext(fromProtoSettings(response.settings));
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('GetManageSiteContext RPC error', { error: err.message });
    }
    throw err;
  }
}

/**
 * Get the site manifest containing settings and menus
 * Menus are pre-filtered by user role on the server
 */
const getManifestSnapshotCached = cache(async (requestedLocale: string | null): Promise<ManifestSnapshot> => {
  try {
    const client = await createManifestClient(requestedLocale);
    const response = await client.get({});

    return {
      manifest: {
        settings: fromProtoSettings(response.settings),
        menus: response.menus ?? DEFAULT_MANIFEST.menus,
      },
      hasSettings: response.settings !== undefined,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      try {
        const client = createPublicManifestClient(requestedLocale);
        const response = await client.get({});
        return {
          manifest: {
            settings: fromProtoSettings(response.settings),
            menus: response.menus ?? DEFAULT_MANIFEST.menus,
          },
          hasSettings: response.settings !== undefined,
        };
      } catch (fallbackErr) {
        if (isConnectError(fallbackErr)) {
          logger.error('GetManifest public fallback RPC error', { error: fallbackErr.message });
        }
        return { manifest: DEFAULT_MANIFEST, hasSettings: false };
      }
    }
    if (isConnectError(err)) {
      logger.error('GetManifest RPC error', { error: err.message });
    }
    return { manifest: DEFAULT_MANIFEST, hasSettings: false };
  }
});

export function getManifestSnapshot(options?: ManifestQueryOptions): Promise<ManifestSnapshot> {
  return getManifestSnapshotCached(normalizeRequestedLocale(options?.requestedLocale));
}

export async function getManifest(options?: ManifestQueryOptions): Promise<Manifest> {
  return (await getManifestSnapshot(options)).manifest;
}

// Page view data for homepage rendering
export interface PublicPageData {
  id: string;
  title: string;
  slug: string | null;
  featuredImageUrl: string | null;
  showTitle: boolean;
  content: LocalizedPageSection[] | null;
  blockMedia: ContentBlockMediaItem[];
  documentLayout: DocumentLayout;
  localizationInfo?: PublicLocalizationInfoLike | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
}

/**
 * Get page content using the public page API
 * - slug="/" returns homepage page (or null if not configured)
 * - slug="about" returns the page with that slug
 */
const getPublicPageCached = cache(
  async (slug: string, requestedLocale: string | null): Promise<PublicPageData | null> => {
    try {
      const client = requestedLocale ? await createPublicPageClientWithAuth(requestedLocale) : createPublicPageClient();
      const response = await client.get({ slug });

      const page = response.page;
      if (!page) {
        return null;
      }

      const content = page.document ? materializeLocalizedPageSections(page.document) : null;

      return {
        id: page.id,
        title: page.title,
        slug: page.slug ?? null,
        featuredImageUrl: resolveFeaturedImageDeliveryUrl(page.featuredImageDelivery),
        showTitle: page.showTitle,
        content,
        blockMedia: response.blockMedia,
        documentLayout: mapProtoDocumentLayout(page.documentLayout),
        localizationInfo: mapPublicLocalizationInfo(page.localizationInfo),
        createdAt: page.createdAt ? timestampDate(page.createdAt) : null,
        updatedAt: page.updatedAt ? timestampDate(page.updatedAt) : null,
        publishedAt: page.publishedAt ? timestampDate(page.publishedAt) : null,
      };
    } catch (err) {
      if (isConnectError(err)) {
        logger.error('GetPublicPage RPC error', { error: err.message });
      }
      return null;
    }
  },
);

export function getPublicPage(
  slug: string,
  options?: { requestedLocale?: string | null },
): Promise<PublicPageData | null> {
  return getPublicPageCached(slug, normalizeRequestedLocale(options?.requestedLocale));
}
