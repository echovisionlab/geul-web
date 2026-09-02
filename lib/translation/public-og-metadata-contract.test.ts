import { describe, expect, it } from 'vitest';
import {
  buildFormOgMetadata,
  buildArtistOgMetadata,
  buildPageOgMetadata,
  buildPostOgMetadata,
  buildProgramEventOgMetadata,
  buildSeriesOgMetadata,
  buildWorkOgMetadata,
} from '@/lib/utils/og';
import { resolveLocalizedOgFallbacks } from './metadata';

const targetProjection = {
  requestedLocale: 'en',
  displayedLocale: 'en',
  sourceLocale: 'ko',
};
const sourceFallback = {
  requestedLocale: 'en',
  displayedLocale: 'ko',
  sourceLocale: 'ko',
};
const sourceImages = {
  featuredImageUrl: 'https://cdn.example.test/source-featured.webp',
  siteOgImageUrl: 'https://cdn.example.test/source-site-og.webp',
};

const localizedBuilders = [
  {
    domain: 'Artist',
    build: (title: string, images: ReturnType<typeof resolveLocalizedOgFallbacks> & { ogImageUrl?: string | null }) =>
      buildArtistOgMetadata({
        canonicalOrigin: 'https://studio.example.test',
        routePath: '/artists/artist',
        name: title,
        imageUrl: images.featuredImageUrl,
        ogImageUrl: images.ogImageUrl,
        siteOgImageUrl: images.siteOgImageUrl,
      }),
  },
  {
    domain: 'Page',
    build: (title: string, images: ReturnType<typeof resolveLocalizedOgFallbacks> & { ogImageUrl?: string | null }) =>
      buildPageOgMetadata({
        canonicalOrigin: 'https://studio.example.test',
        routePath: '/page',
        title,
        ...images,
      }),
  },
  {
    domain: 'Post',
    build: (title: string, images: ReturnType<typeof resolveLocalizedOgFallbacks> & { ogImageUrl?: string | null }) =>
      buildPostOgMetadata({
        canonicalOrigin: 'https://studio.example.test',
        routePath: '/posts/post',
        title,
        ...images,
      }),
  },
  {
    domain: 'Work',
    build: (title: string, images: ReturnType<typeof resolveLocalizedOgFallbacks> & { ogImageUrl?: string | null }) =>
      buildWorkOgMetadata({
        canonicalOrigin: 'https://studio.example.test',
        routePath: '/works/work',
        title,
        ...images,
      }),
  },
  {
    domain: 'Form',
    build: (title: string, images: ReturnType<typeof resolveLocalizedOgFallbacks> & { ogImageUrl?: string | null }) =>
      buildFormOgMetadata({
        canonicalOrigin: 'https://studio.example.test',
        routePath: '/forms/form',
        title,
        ...images,
      }),
  },
  {
    domain: 'Series',
    build: (title: string, images: ReturnType<typeof resolveLocalizedOgFallbacks> & { ogImageUrl?: string | null }) =>
      buildSeriesOgMetadata({
        canonicalOrigin: 'https://studio.example.test',
        routePath: '/series/series',
        title,
        ...images,
      }),
  },
  {
    domain: 'Legal',
    build: (title: string, images: ReturnType<typeof resolveLocalizedOgFallbacks> & { ogImageUrl?: string | null }) =>
      buildPageOgMetadata({
        canonicalOrigin: 'https://studio.example.test',
        routePath: '/terms',
        title,
        ...images,
      }),
  },
] as const;

describe('localized public OG metadata contract', () => {
  it.each(localizedBuilders)('uses only the exact target asset for $domain', ({ build }) => {
    const metadata = build('Target title', {
      ...resolveLocalizedOgFallbacks(targetProjection, sourceImages),
      ogImageUrl: 'https://cdn.example.test/exact-target-og.webp',
    });

    expect(metadata.openGraph.title).toBe('Target title');
    expect(metadata.openGraph.images?.[0]?.url).toBe('https://cdn.example.test/exact-target-og.webp');
  });

  it.each(localizedBuilders)('omits the image while the $domain target OG is pending', ({ build }) => {
    const metadata = build('Target title', resolveLocalizedOgFallbacks(targetProjection, sourceImages));

    expect(metadata.openGraph.title).toBe('Target title');
    expect(metadata.openGraph.images).toBeUndefined();
    expect(metadata.twitter.images).toBeUndefined();
    expect(metadata.twitter.card).toBe('summary');
  });

  it.each(localizedBuilders)('keeps source text and source image together for $domain fallback', ({ build }) => {
    const metadata = build('Source title', resolveLocalizedOgFallbacks(sourceFallback, sourceImages));

    expect(metadata.openGraph.title).toBe('Source title');
    expect(metadata.openGraph.images?.[0]?.url).toBe(sourceImages.featuredImageUrl);
  });

  it('uses the language-neutral Program Event poster for translated event text', () => {
    const metadata = buildProgramEventOgMetadata({
      canonicalOrigin: 'https://studio.example.test',
      routePath: '/events/event',
      title: 'Target Event',
      posterUrl: 'https://cdn.example.test/global-event-poster.webp',
      siteOgImageUrl: sourceImages.siteOgImageUrl,
    });

    expect(metadata.openGraph.title).toBe('Target Event');
    expect(metadata.openGraph.images).toEqual([{ url: 'https://cdn.example.test/global-event-poster.webp' }]);
  });
});
