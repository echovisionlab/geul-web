import { describe, expect, it } from 'vitest';
import type { FaviconAssetSetUrls } from '@/lib/queries/manifest';
import {
  buildSiteApplicationMetadata,
  buildWebAppManifest,
  normalizeSiteApplicationTitle,
} from './site-application-metadata';

const FAVICON_ASSET_SET: FaviconAssetSetUrls = {
  icon_ico_url: 'https://cdn.example.com/asset/favicon-v2/favicon.ico',
  icon_png_16_url: 'https://cdn.example.com/asset/favicon-v2-16/favicon.png',
  icon_png_32_url: 'https://cdn.example.com/asset/favicon-v2-32/favicon.png',
  icon_png_48_url: 'https://cdn.example.com/asset/favicon-v2-48/favicon.png',
  apple_touch_icon_180_url: 'https://cdn.example.com/asset/favicon-v2-apple/favicon.png',
  manifest_icon_192_url: 'https://cdn.example.com/asset/favicon-v2-192/favicon.png',
  manifest_icon_512_url: 'https://cdn.example.com/asset/favicon-v2-512/favicon.png',
  icon_svg_url: 'https://cdn.example.com/asset/favicon-v2/favicon.svg',
};

describe('site application metadata', () => {
  it('declares the complete generated favicon set with exact formats and sizes', () => {
    expect(
      buildSiteApplicationMetadata({
        title: 'Example Studio',
        faviconAssetSet: FAVICON_ASSET_SET,
        legacyFaviconUrl: 'https://cdn.example.com/asset/legacy/favicon.png',
      }),
    ).toEqual({
      applicationName: 'Example Studio',
      appleWebApp: {
        capable: true,
        title: 'Example Studio',
      },
      manifest: '/manifest.webmanifest',
      icons: {
        icon: [
          {
            url: 'https://cdn.example.com/asset/favicon-v2/favicon.svg',
            type: 'image/svg+xml',
            sizes: 'any',
          },
          {
            url: 'https://cdn.example.com/asset/favicon-v2-16/favicon.png',
            type: 'image/png',
            sizes: '16x16',
          },
          {
            url: 'https://cdn.example.com/asset/favicon-v2-32/favicon.png',
            type: 'image/png',
            sizes: '32x32',
          },
          {
            url: 'https://cdn.example.com/asset/favicon-v2-48/favicon.png',
            type: 'image/png',
            sizes: '48x48',
          },
        ],
        shortcut: {
          url: 'https://cdn.example.com/asset/favicon-v2/favicon.ico',
          type: 'image/x-icon',
        },
        apple: {
          url: 'https://cdn.example.com/asset/favicon-v2-apple/favicon.png',
          type: 'image/png',
          sizes: '180x180',
        },
      },
    });
  });

  it('omits the optional SVG without affecting canonical PNG and ICO links', () => {
    const metadata = buildSiteApplicationMetadata({
      title: 'Example Studio',
      faviconAssetSet: { ...FAVICON_ASSET_SET, icon_svg_url: null },
      legacyFaviconUrl: null,
    });

    expect(metadata.icons).toMatchObject({
      icon: [
        { sizes: '16x16', type: 'image/png' },
        { sizes: '32x32', type: 'image/png' },
        { sizes: '48x48', type: 'image/png' },
      ],
      shortcut: { type: 'image/x-icon' },
    });
  });

  it('uses only the old favicon link when no generated set exists', () => {
    expect(
      buildSiteApplicationMetadata({
        title: 'Example Studio',
        faviconAssetSet: null,
        legacyFaviconUrl: 'https://cdn.example.com/asset/legacy/favicon.png',
      }),
    ).toEqual({
      applicationName: 'Example Studio',
      appleWebApp: {
        capable: true,
        title: 'Example Studio',
      },
      manifest: '/manifest.webmanifest',
      icons: {
        icon: 'https://cdn.example.com/asset/legacy/favicon.png',
      },
    });
  });

  it('builds a PWA manifest from versioned 192 and 512 PNG assets', () => {
    expect(
      buildWebAppManifest({
        siteTitle: ' Example Studio ',
        primaryColor: '#123456',
        faviconAssetSet: FAVICON_ASSET_SET,
      }),
    ).toEqual({
      name: 'Example Studio',
      short_name: 'Example Studio',
      start_url: '/',
      display: 'standalone',
      theme_color: '#123456',
      background_color: '#ffffff',
      icons: [
        {
          src: 'https://cdn.example.com/asset/favicon-v2-192/favicon.png',
          type: 'image/png',
          sizes: '192x192',
          purpose: 'any',
        },
        {
          src: 'https://cdn.example.com/asset/favicon-v2-512/favicon.png',
          type: 'image/png',
          sizes: '512x512',
          purpose: 'any',
        },
      ],
    });
  });

  it('omits manifest icons when no complete generated set exists', () => {
    expect(
      buildWebAppManifest({
        siteTitle: '',
        primaryColor: '',
        faviconAssetSet: null,
      }),
    ).toEqual({
      name: 'Geul',
      short_name: 'Geul',
      start_url: '/',
      display: 'standalone',
      theme_color: '#b02d23',
      background_color: '#ffffff',
      icons: undefined,
    });
    expect(normalizeSiteApplicationTitle('   ')).toBe('Geul');
  });
});
