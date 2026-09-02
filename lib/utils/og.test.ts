import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildFormOgMetadata,
  buildLabelOgMetadata,
  buildPostOgMetadata,
  buildProgramEventOgMetadata,
  buildProgramEventSeriesOgMetadata,
  buildReleaseOgMetadata,
  buildSeriesOgMetadata,
  truncateForDescription,
} from './og';

vi.mock('@/lib/public-runtime-config', () => ({
  getPublicCdnUrl: () => 'https://cdn.example.test',
}));

describe('truncateForDescription', () => {
  it('strips HTML and collapses whitespace', () => {
    expect(truncateForDescription('<p>Hello</p>\n<strong>world</strong>   again')).toBe('Hello world again');
  });

  it('truncates on a word boundary when possible', () => {
    expect(
      truncateForDescription('One two three four five six seven eight nine ten eleven twelve thirteen fourteen', 40),
    ).toBe('One two three four five six seven...');
  });
});

describe('buildPostOgMetadata', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('derives title, description, canonical URL, and image from title/summary/fallbacks', () => {
    const metadata = buildPostOgMetadata({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/posts/signal-mesh',
      title: 'Signal Mesh',
      summary: 'Search-first description',
      ogImageUrl: 'https://cdn.example.test/asset/generated/og.webp',
      featuredImageUrl: 'https://images.example.test/featured.webp',
      siteOgImageUrl: 'https://cdn.example.test/asset/site-default/og.webp',
      siteName: 'Example Studio',
      publishedAt: new Date('2026-03-01T00:00:00Z'),
      authors: ['A. Author'],
    });

    expect(metadata).toEqual({
      title: 'Signal Mesh',
      description: 'Search-first description',
      alternates: {
        canonical: 'https://studio.example.com/posts/signal-mesh',
      },
      openGraph: {
        title: 'Signal Mesh',
        description: 'Search-first description',
        type: 'article',
        url: 'https://studio.example.com/posts/signal-mesh',
        images: [
          {
            url: 'https://cdn.example.test/asset/generated/og.webp',
            width: 1200,
            height: 630,
          },
        ],
        siteName: 'Example Studio',
        publishedTime: '2026-03-01T00:00:00.000Z',
        authors: ['A. Author'],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Signal Mesh',
        description: 'Search-first description',
        images: ['https://cdn.example.test/asset/generated/og.webp'],
      },
    });
  });

  it('falls back from generated image to featured image to site default image', () => {
    const generatedImage = buildPostOgMetadata({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/posts/generated',
      title: 'Generated',
      ogImageUrl: 'https://cdn.example.test/asset/generated/og.webp',
    });
    expect(generatedImage.openGraph.images?.[0]?.url).toBe('https://cdn.example.test/asset/generated/og.webp');

    const featuredImage = buildPostOgMetadata({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/posts/featured',
      title: 'Featured',
      featuredImageUrl: 'https://images.example.test/featured.webp',
    });
    expect(featuredImage.openGraph.images?.[0]?.url).toBe('https://images.example.test/featured.webp');

    const siteDefault = buildPostOgMetadata({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/posts/default',
      title: 'Default',
      siteOgImageUrl: 'https://cdn.example.test/asset/site-default/og.webp',
    });
    expect(siteDefault.openGraph.images?.[0]?.url).toBe('https://cdn.example.test/asset/site-default/og.webp');
  });
});

describe('buildFormOgMetadata', () => {
  it('falls back from generated OG to featured image to the Site OG image', () => {
    const base = {
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/forms/survey',
      title: 'Survey',
      featuredImageUrl: 'https://images.example.test/form-featured.webp',
      siteOgImageUrl: 'https://cdn.example.test/asset/site-default.webp',
    };

    expect(
      buildFormOgMetadata({
        ...base,
        ogImageUrl: 'https://cdn.example.test/asset/form-generated.webp',
      }).openGraph.images?.[0]?.url,
    ).toBe('https://cdn.example.test/asset/form-generated.webp');
    expect(buildFormOgMetadata(base).openGraph.images?.[0]?.url).toBe('https://images.example.test/form-featured.webp');
    expect(
      buildFormOgMetadata({
        ...base,
        featuredImageUrl: null,
      }).openGraph.images?.[0]?.url,
    ).toBe('https://cdn.example.test/asset/site-default.webp');
  });
});

describe('buildSeriesOgMetadata', () => {
  it('falls back from the locale OG image to the global Featured Image and Site OG image', () => {
    const base = {
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/series/field-notes',
      title: 'Field Notes',
      featuredImageUrl: 'https://images.example.test/series-featured.webp',
      siteOgImageUrl: 'https://cdn.example.test/asset/site-default.webp',
    };

    expect(
      buildSeriesOgMetadata({
        ...base,
        ogImageUrl: 'https://cdn.example.test/asset/series-ko-og.webp',
      }).openGraph.images?.[0]?.url,
    ).toBe('https://cdn.example.test/asset/series-ko-og.webp');
    expect(buildSeriesOgMetadata(base).openGraph.images?.[0]?.url).toBe(
      'https://images.example.test/series-featured.webp',
    );
    expect(buildSeriesOgMetadata({ ...base, featuredImageUrl: null }).openGraph.images?.[0]?.url).toBe(
      'https://cdn.example.test/asset/site-default.webp',
    );
  });
});

describe('buildProgramEventSeriesOgMetadata', () => {
  it('uses the global poster directly and falls back to the Site OG image', () => {
    const poster = buildProgramEventSeriesOgMetadata({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/event-series/festival',
      title: 'Festival',
      posterUrl: 'https://cdn.example.test/asset/poster/poster.webp',
      siteOgImageUrl: 'https://cdn.example.test/asset/site-default/og.webp',
    });
    expect(poster.openGraph.images?.[0]?.url).toBe('https://cdn.example.test/asset/poster/poster.webp');
    expect(poster.openGraph.images?.[0]).toEqual({ url: 'https://cdn.example.test/asset/poster/poster.webp' });

    const fallback = buildProgramEventSeriesOgMetadata({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/event-series/festival',
      title: 'Festival',
      siteOgImageUrl: 'https://cdn.example.test/asset/site-default/og.webp',
    });
    expect(fallback.openGraph.images?.[0]?.url).toBe('https://cdn.example.test/asset/site-default/og.webp');
  });
});

describe('buildProgramEventOgMetadata', () => {
  it('uses the primary poster directly and falls back to the Site OG image', () => {
    const poster = buildProgramEventOgMetadata({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/events/open-studio',
      title: 'Open Studio',
      posterUrl: 'https://cdn.example.test/asset/poster/event.webp',
      siteOgImageUrl: 'https://cdn.example.test/asset/site-default/og.webp',
    });
    expect(poster.openGraph.images?.[0]).toEqual({
      url: 'https://cdn.example.test/asset/poster/event.webp',
    });

    const fallback = buildProgramEventOgMetadata({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/events/open-studio',
      title: 'Open Studio',
      siteOgImageUrl: 'https://cdn.example.test/asset/site-default/og.webp',
    });
    expect(fallback.openGraph.images?.[0]?.url).toBe('https://cdn.example.test/asset/site-default/og.webp');
  });

  it('keeps the global poster as the translated Program Event image without substituting a locale OG', () => {
    const metadata = buildProgramEventOgMetadata({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/events/open-studio?lang=en',
      title: 'Translated event title',
      posterUrl: 'https://cdn.example.test/asset/poster/shared-event.webp',
      siteOgImageUrl: 'https://cdn.example.test/asset/site-default/og.webp',
    });

    expect(metadata.openGraph.title).toBe('Translated event title');
    expect(metadata.openGraph.images).toEqual([{ url: 'https://cdn.example.test/asset/poster/shared-event.webp' }]);
  });
});

describe('buildReleaseOgMetadata', () => {
  it('uses artwork directly without fabricated dimensions and otherwise falls back to Site OG', () => {
    const artwork = buildReleaseOgMetadata({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/releases/direct-artwork',
      title: 'Direct Artwork',
      description: 'Release description',
      artworkUrl: 'https://cdn.example.test/asset/release/artwork.webp',
      siteOgImageUrl: 'https://cdn.example.test/asset/site-default/og.webp',
    });
    expect(artwork.openGraph.images?.[0]).toEqual({
      url: 'https://cdn.example.test/asset/release/artwork.webp',
    });

    const fallback = buildReleaseOgMetadata({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/releases/no-artwork',
      title: 'No Artwork',
      description: 'Release description',
      siteOgImageUrl: 'https://cdn.example.test/asset/site-default/og.webp',
    });
    expect(fallback.openGraph.images?.[0]).toEqual({
      url: 'https://cdn.example.test/asset/site-default/og.webp',
    });
  });
});

describe('buildLabelOgMetadata', () => {
  it('uses the generated logo canvas and otherwise falls back directly to Site OG', () => {
    const generated = buildLabelOgMetadata({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/labels/signal',
      name: 'Signal',
      ogImageUrl: 'https://cdn.example.test/asset/label-generated/og.webp',
      siteOgImageUrl: 'https://cdn.example.test/asset/site-default/og.webp',
    });
    expect(generated.openGraph.images?.[0]?.url).toBe('https://cdn.example.test/asset/label-generated/og.webp');

    const fallback = buildLabelOgMetadata({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/labels/signal',
      name: 'Signal',
      siteOgImageUrl: 'https://cdn.example.test/asset/site-default/og.webp',
    });
    expect(fallback.openGraph.images?.[0]?.url).toBe('https://cdn.example.test/asset/site-default/og.webp');
  });
});
