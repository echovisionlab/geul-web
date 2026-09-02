import { describe, expect, it } from 'vitest';
import type {
  ArtistMetadataDocument,
  HomeMetadataDocument,
  PostMetadataDocument,
  ReleaseMetadataDocument,
  SiteMetadataDocument,
  WorkMetadataDocument,
} from '@/lib/queries/metadata';
import {
  buildArtistJsonLd,
  buildHomeJsonLd,
  buildPostJsonLd,
  buildReleaseJsonLd,
  buildSiteOrganizationJsonLd,
  buildSiteWebSiteJsonLd,
  buildWorkJsonLd,
} from './json-ld';

const site: SiteMetadataDocument = {
  siteTitle: 'Example Studio',
  siteDescription: 'A calm publication about art and technology.',
  canonicalOrigin: 'https://studio.example.com',
  siteOgImageUrl: 'og/site/default.webp',
  companyName: 'Example Studio',
  logoUrl: 'https://cdn.example.test/logo.webp',
  socialLinks: ['https://instagram.com/example-studio', 'https://x.com/example-studio'],
};

describe('JSON-LD builders', () => {
  it('builds site organization and website entities', () => {
    expect(buildSiteOrganizationJsonLd(site)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': 'https://studio.example.com/#organization',
      name: 'Example Studio',
      url: 'https://studio.example.com',
      logo: 'https://cdn.example.test/logo.webp',
      sameAs: ['https://instagram.com/example-studio', 'https://x.com/example-studio'],
    });

    expect(buildSiteWebSiteJsonLd(site)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': 'https://studio.example.com/#website',
      url: 'https://studio.example.com',
      name: 'Example Studio',
      description: 'A calm publication about art and technology.',
      publisher: { '@id': 'https://studio.example.com/#organization' },
    });
  });

  it('does not mix the source site description into a current target home projection', () => {
    const home: HomeMetadataDocument = {
      routePath: '/',
      title: '번역 제목',
      summary: null,
      featuredImageUrl: null,
      ogImageUrl: null,
      createdAt: null,
      updatedAt: null,
      publishedAt: null,
      localizationInfo: {
        requestedLocale: 'ko',
        displayedLocale: 'ko',
        sourceLocale: 'en',
        isFallback: false,
        isOriginal: false,
        machineGenerated: true,
        fallbackReason: 0,
      },
      site,
    };

    const [webPage] = buildHomeJsonLd(home);
    expect(webPage.description).toBeUndefined();
    expect(JSON.stringify(webPage)).not.toContain(site.siteDescription);
  });

  it('builds post JSON-LD from title and summary', () => {
    const post: PostMetadataDocument = {
      kind: 'post',
      id: 'post-1',
      title: 'Signal Mesh',
      summary: 'Measured description for search.',
      routePath: '/posts/signal-mesh',
      slug: 'signal-mesh',
      featuredImageUrl: 'https://images.example.test/post.webp',
      ogImageUrl: 'og/post/signal-mesh.webp',
      createdAt: new Date('2026-03-01T00:00:00Z'),
      updatedAt: new Date('2026-03-03T00:00:00Z'),
      publishedAt: new Date('2026-03-02T00:00:00Z'),
      site,
      authors: [{ id: 'author-1', name: 'A. Author' }],
      categories: [{ id: 'cat-1', name: 'Essays', slug: 'essays' }],
      tags: [{ id: 'tag-1', name: 'Sensors', slug: 'sensors' }],
      series: null,
      location: null,
    };

    const [article, breadcrumb] = buildPostJsonLd(post);
    expect(article).toMatchObject({
      '@type': 'Article',
      '@id': 'https://studio.example.com/posts/signal-mesh#article',
      headline: 'Signal Mesh',
      description: 'Measured description for search.',
      image: 'https://images.example.test/post.webp',
      mainEntityOfPage: 'https://studio.example.com/posts/signal-mesh',
    });
    expect(breadcrumb).toMatchObject({
      '@type': 'BreadcrumbList',
    });
  });

  it('builds work JSON-LD as CreativeWork with creators', () => {
    const work: WorkMetadataDocument = {
      kind: 'work',
      id: 'work-1',
      title: 'Signal Mesh Installation',
      summary: 'Installation description.',
      routePath: '/works/signal-mesh',
      slug: 'signal-mesh',
      featuredImageUrl: 'https://images.example.test/work.webp',
      ogImageUrl: 'og/work/signal-mesh.webp',
      createdAt: new Date('2026-03-01T00:00:00Z'),
      updatedAt: new Date('2026-03-04T00:00:00Z'),
      publishedAt: new Date('2026-03-02T00:00:00Z'),
      site,
      type: 'portfolio',
      year: 2026,
      month: 3,
      untilYear: null,
      untilMonth: null,
      isPresent: false,
      featured: true,
      location: null,
      credits: [
        {
          id: 'credit-1',
          groupId: null,
          name: null,
          creditRole: 'Artist',
          artist: { id: 'artist-1', name: 'Signal Unit', slug: 'signal-unit' },
          member: null,
        },
        {
          id: 'credit-2',
          groupId: null,
          name: 'Guest Collaborator',
          creditRole: 'Programming',
          artist: null,
          member: null,
        },
      ],
      clients: [],
    };

    const [creativeWork] = buildWorkJsonLd(work);
    expect(creativeWork).toMatchObject({
      '@type': 'CreativeWork',
      '@id': 'https://studio.example.com/works/signal-mesh#creativework',
      description: 'Installation description.',
      creator: [
        { '@type': 'Person', name: 'Signal Unit' },
        { '@type': 'Person', name: 'Guest Collaborator' },
      ],
    });
  });

  it('builds artist JSON-LD as MusicGroup when artist has children', () => {
    const artist: ArtistMetadataDocument = {
      kind: 'artist',
      id: 'artist-1',
      name: 'Signal Unit',
      bio: 'An audio-visual group.',
      slug: 'signal-unit',
      imageUrl: 'https://images.example.test/artist.webp',
      ogImageUrl: 'og/artist/signal-unit.webp',
      routePath: '/artists/signal-unit',
      isGroup: true,
      socialLinks: ['https://instagram.com/signal-unit'],
      createdAt: new Date('2026-03-01T00:00:00Z'),
      updatedAt: new Date('2026-03-02T00:00:00Z'),
      publishedAt: new Date('2026-03-02T00:00:00Z'),
      site,
    };

    const [entity] = buildArtistJsonLd(artist);
    expect(entity).toMatchObject({
      '@type': 'MusicGroup',
      '@id': 'https://studio.example.com/artists/signal-unit#person',
      sameAs: ['https://instagram.com/signal-unit'],
    });
  });

  it('builds release JSON-LD with byArtist links', () => {
    const release: ReleaseMetadataDocument = {
      kind: 'release',
      id: 'release-1',
      title: 'Quiet Systems',
      description: 'Debut release.',
      slug: 'quiet-systems',
      type: 'album',
      artworkUrl: 'https://images.example.test/release.webp',
      ogImageUrl: 'og/release/quiet-systems.webp',
      routePath: '/releases/quiet-systems',
      artists: [{ id: 'artist-1', name: 'Signal Unit', slug: 'signal-unit' }],
      releaseDate: new Date('2026-03-05T00:00:00Z'),
      publishedAt: new Date('2026-03-06T00:00:00Z'),
      site,
    };

    const [album] = buildReleaseJsonLd(release);
    expect(album).toMatchObject({
      '@type': 'MusicAlbum',
      '@id': 'https://studio.example.com/releases/quiet-systems#album',
      description: 'Debut release.',
      byArtist: [
        {
          '@type': 'MusicGroup',
          name: 'Signal Unit',
          url: 'https://studio.example.com/artists/signal-unit',
        },
      ],
    });
  });
});
