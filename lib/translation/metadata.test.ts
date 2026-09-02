import { describe, expect, it } from 'vitest';
import { buildContentMetadataSeo, resolveLocalizedMetadataSummary, resolveLocalizedOgFallbacks } from './metadata';

describe('resolveLocalizedOgFallbacks', () => {
  it.each(['Page', 'Post', 'Work', 'Terms', 'Privacy'])(
    'omits source/global image fallbacks while the %s target OG is pending',
    () => {
      expect(
        resolveLocalizedOgFallbacks(
          {
            requestedLocale: 'en',
            displayedLocale: 'en',
            sourceLocale: 'ko',
          },
          {
            featuredImageUrl: 'https://cdn.example.test/source-featured.webp',
            siteOgImageUrl: 'https://cdn.example.test/site-og.webp',
          },
        ),
      ).toEqual({ featuredImageUrl: null, siteOgImageUrl: null });
    },
  );

  it('keeps the complete source image fallback when the requested target is missing', () => {
    const sourceImages = {
      featuredImageUrl: 'https://cdn.example.test/source-featured.webp',
      siteOgImageUrl: 'https://cdn.example.test/site-og.webp',
    };

    expect(
      resolveLocalizedOgFallbacks(
        {
          requestedLocale: 'en',
          displayedLocale: 'ko',
          sourceLocale: 'ko',
        },
        sourceImages,
      ),
    ).toEqual(sourceImages);
  });
});

describe('resolveLocalizedMetadataSummary', () => {
  it('omits the source summary when a target intentionally has no summary', () => {
    expect(
      resolveLocalizedMetadataSummary(
        { requestedLocale: 'ko', displayedLocale: 'ko', sourceLocale: 'en' },
        null,
        'Source description',
      ),
    ).toBeNull();
  });

  it('uses the source summary only when the public resolver displays the source locale', () => {
    expect(
      resolveLocalizedMetadataSummary(
        { requestedLocale: 'ko', displayedLocale: 'en', sourceLocale: 'en' },
        null,
        'Source description',
      ),
    ).toBe('Source description');
  });
});

describe('buildContentMetadataSeo', () => {
  it('uses the route path as canonical when there is no explicit locale override', () => {
    const result = buildContentMetadataSeo({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/forms/contact',
      localizationInfo: {
        requestedLocale: 'ko',
        displayedLocale: 'ko',
        sourceLocale: 'en',
      },
    });

    expect(result.alternates?.canonical).toBe('https://studio.example.com/forms/contact');
    expect(result.alternates?.languages?.ko).toBe('https://studio.example.com/forms/contact?lang=ko');
    expect(result.alternates?.languages?.['x-default']).toBe('https://studio.example.com/forms/contact');
    expect(result.openGraph.url).toBe('https://studio.example.com/forms/contact');
    expect(result.openGraph.locale).toBe('ko_KR');
    expect(result.openGraph.alternateLocale).toContain('en_US');
    expect(result.openGraph.alternateLocale).not.toContain('ko_KR');
    expect(result.noIndex).toBe(false);
  });

  it('uses the displayed locale in canonical urls for explicit locale views', () => {
    const result = buildContentMetadataSeo({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/forms/contact',
      query: { lang: 'ko' },
      localizationInfo: {
        requestedLocale: 'ko',
        displayedLocale: 'ko',
        sourceLocale: 'en',
      },
    });

    expect(result.alternates?.canonical).toBe('https://studio.example.com/forms/contact?lang=ko');
    expect(result.openGraph.url).toBe('https://studio.example.com/forms/contact?lang=ko');
    expect(result.noIndex).toBe(false);
  });

  it('falls back canonical to the displayed source locale and noindexes missing explicit locale views', () => {
    const result = buildContentMetadataSeo({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/posts/example',
      query: { lang: 'ja' },
      localizationInfo: {
        requestedLocale: 'ja',
        displayedLocale: 'en',
        sourceLocale: 'ko',
      },
    });

    expect(result.alternates?.canonical).toBe('https://studio.example.com/posts/example');
    expect(result.noIndex).toBe(true);
  });

  it('uses the explicit source locale canonical without forcing noindex', () => {
    const result = buildContentMetadataSeo({
      canonicalOrigin: 'https://studio.example.com',
      routePath: '/works/sample',
      query: { lang: 'ko' },
      localizationInfo: {
        requestedLocale: 'ko',
        displayedLocale: 'ko',
        sourceLocale: 'ko',
      },
    });

    expect(result.alternates?.canonical).toBe('https://studio.example.com/works/sample?lang=ko');
    expect(result.noIndex).toBe(false);
  });
});
