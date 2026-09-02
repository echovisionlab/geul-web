import type { Metadata, MetadataRoute } from 'next';
import type { FaviconAssetSetUrls } from '@/lib/queries/manifest';

const DEFAULT_SITE_TITLE = 'Geul';
const DEFAULT_THEME_COLOR = '#b02d23';
const DEFAULT_BACKGROUND_COLOR = '#ffffff';

export interface SiteApplicationMetadataInput {
  faviconAssetSet: FaviconAssetSetUrls | null;
  legacyFaviconUrl: string | null;
  title: string;
}

export function normalizeSiteApplicationTitle(title: string | null | undefined): string {
  return title?.trim() || DEFAULT_SITE_TITLE;
}

export function buildSiteApplicationMetadata({
  faviconAssetSet,
  legacyFaviconUrl,
  title,
}: SiteApplicationMetadataInput): Pick<Metadata, 'applicationName' | 'appleWebApp' | 'icons' | 'manifest'> {
  const applicationMetadata = {
    applicationName: title,
    appleWebApp: {
      capable: true,
      title,
    },
    manifest: '/manifest.webmanifest',
  } satisfies Pick<Metadata, 'applicationName' | 'appleWebApp' | 'manifest'>;

  if (!faviconAssetSet) {
    return {
      ...applicationMetadata,
      icons: legacyFaviconUrl ? { icon: legacyFaviconUrl } : undefined,
    };
  }

  return {
    ...applicationMetadata,
    icons: {
      icon: [
        ...(faviconAssetSet.icon_svg_url
          ? [
              {
                url: faviconAssetSet.icon_svg_url,
                type: 'image/svg+xml',
                sizes: 'any',
              },
            ]
          : []),
        {
          url: faviconAssetSet.icon_png_16_url,
          type: 'image/png',
          sizes: '16x16',
        },
        {
          url: faviconAssetSet.icon_png_32_url,
          type: 'image/png',
          sizes: '32x32',
        },
        {
          url: faviconAssetSet.icon_png_48_url,
          type: 'image/png',
          sizes: '48x48',
        },
      ],
      shortcut: {
        url: faviconAssetSet.icon_ico_url,
        type: 'image/x-icon',
      },
      apple: {
        url: faviconAssetSet.apple_touch_icon_180_url,
        type: 'image/png',
        sizes: '180x180',
      },
    },
  };
}

export interface WebAppManifestInput {
  faviconAssetSet: FaviconAssetSetUrls | null;
  primaryColor: string | null | undefined;
  siteTitle: string | null | undefined;
}

export function buildWebAppManifest({
  faviconAssetSet,
  primaryColor,
  siteTitle,
}: WebAppManifestInput): MetadataRoute.Manifest {
  const title = normalizeSiteApplicationTitle(siteTitle);

  return {
    name: title,
    short_name: title,
    start_url: '/',
    display: 'standalone',
    theme_color: primaryColor?.trim() || DEFAULT_THEME_COLOR,
    background_color: DEFAULT_BACKGROUND_COLOR,
    icons: faviconAssetSet
      ? [
          {
            src: faviconAssetSet.manifest_icon_192_url,
            type: 'image/png',
            sizes: '192x192',
            purpose: 'any',
          },
          {
            src: faviconAssetSet.manifest_icon_512_url,
            type: 'image/png',
            sizes: '512x512',
            purpose: 'any',
          },
        ]
      : undefined,
  };
}
