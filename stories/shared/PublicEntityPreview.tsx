import { useLocale } from 'next-intl';
import { ArtistPublicView, type ArtistPublicViewProps } from '@/app/(general)/artists/[idOrSlug]/ArtistPublicView';
import { LabelPublicView, type LabelPublicViewProps } from '@/app/(general)/labels/[idOrSlug]/LabelPublicView';
import { ReleasePublicView, type ReleasePublicViewProps } from '@/app/(general)/releases/[idOrSlug]/ReleasePublicView';
import { prepareReleaseStreamingLinks } from '@/app/(general)/releases/[idOrSlug]/release-streaming-links';
import { prepareArtistPublicView } from '@/app/(general)/artists/[idOrSlug]/artist-public-prepared';
import { prepareLabelPublicView } from '@/app/(general)/labels/[idOrSlug]/label-public-prepared';
import { prepareSocialLinksDisplay } from '@/features/social-links/prepare-social-links-display';
import { LayoutContainer, LayoutInset } from '@/components/core/Layout';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
const localizationInfo = {
  requestedLocale: 'en',
  displayedLocale: 'en',
  sourceLocale: 'en',
  availableLocales: ['en', 'ko', 'ja'],
  isFallback: false,
  isOriginal: true,
  machineGenerated: false,
  fallbackReason: 0,
};
const artist: ArtistPublicViewProps['artist'] = {
  id: '10000000-0000-4000-8000-000000000501',
  name: 'June Han',
  slug: 'june-han',
  realName: null,
  content: null,
  countryCode: 'KR',
  website: 'https://example.org',
  imageUrl: null,
  images: [],
  socialLinks: { github: 'https://github.com/example' },
  isGroup: false,
  localizationInfo,
  labels: [{ id: 'label-1', name: 'Quiet Signals', slug: 'quiet-signals' }],
  works: [{ id: 'work-1', title: 'Field Notes', slug: 'field-notes', type: 'portfolio', featuredImageUrl: null }],
  releases: [
    {
      id: 'release-1',
      title: 'Small Rooms',
      slug: 'small-rooms',
      type: 'album',
      artworkUrl: null,
      releaseDate: new Date('2026-09-12T00:00:00Z'),
      artists: [],
    },
  ],
  tracks: [],
};
const label: LabelPublicViewProps['label'] = {
  id: '10000000-0000-4000-8000-000000000502',
  name: 'Quiet Signals',
  slug: 'quiet-signals',
  descriptionText: null,
  content: null,
  ogImageUrl: null,
  imageUrl: null,
  imageLightUrl: null,
  imageDarkUrl: null,
  website: 'https://example.org',
  countryCode: 'JP',
  socialLinks: {},
  status: 'published',
  releaseCount: 1,
  artistCount: 1,
  parentLabel: null,
  artists: [{ id: artist.id, name: artist.name, slug: artist.slug, imageUrl: null }],
  releases: [
    {
      id: 'release-1',
      title: 'Small Rooms',
      slug: 'small-rooms',
      type: 'album',
      artworkUrl: null,
      releaseDate: new Date('2026-09-12T00:00:00Z'),
      publishedAt: new Date('2026-09-12T00:00:00Z'),
      artists: [{ id: artist.id, name: artist.name, slug: artist.slug }],
    },
  ],
  createdAt: null,
  updatedAt: null,
  publishedAt: null,
  localizationInfo,
};
const release: ReleasePublicViewProps['release'] = {
  id: '10000000-0000-4000-8000-000000000503',
  title: 'Small Rooms',
  slug: 'small-rooms',
  type: 'album',
  descriptionText: null,
  content: null,
  artworkUrl: null,
  catalogNumber: 'QS-001',
  releaseDate: new Date('2026-09-12T00:00:00Z'),
  publishedAt: null,
  status: 'published',
  spotifyUrl: null,
  appleMusicUrl: null,
  bandcampUrl: 'https://example.org',
  youtubeMusicUrl: null,
  ogImageUrl: null,
  localizationInfo,
  labels: [{ id: label.id, name: label.name, slug: label.slug, catalogNumber: 'QS-001' }],
  genres: [{ id: 'genre-1', name: 'Ambient', slug: 'ambient' }],
  styles: [],
  formats: [{ id: 'format-1', name: 'Digital', slug: 'digital', description: null }],
  credits: [],
  artists: [{ id: artist.id, name: artist.name, slug: artist.slug, imageUrl: null, role: 'primary' }],
  tracks: [],
};
export function PublicEntityPreview({
  domain = 'artist',
  empty = false,
}: {
  domain?: 'artist' | 'label' | 'release';
  empty?: boolean;
}) {
  const locale = useLocale();
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const common = { query: {}, uiLocale: locale, requestedLocale: locale };
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide">
        <LayoutInset space="md">
          {domain === 'artist' ? (
            <ArtistPublicView
              {...common}
              artistMetadata={null}
              artist={empty ? { ...artist, labels: [], works: [], releases: [] } : artist}
              {...prepareArtistPublicView(artist, locale)}
              socialLinkEntries={prepareSocialLinksDisplay(artist.socialLinks ?? {})}
            />
          ) : null}
          {domain === 'label' ? (
            <LabelPublicView
              {...common}
              labelMetadata={null}
              label={empty ? { ...label, artists: [], releases: [], artistCount: 0, releaseCount: 0 } : label}
              {...prepareLabelPublicView(label, locale)}
              socialLinkEntries={prepareSocialLinksDisplay(label.socialLinks ?? {})}
            />
          ) : null}
          {domain === 'release' ? (
            <ReleasePublicView
              {...common}
              releaseMetadata={null}
              release={empty ? { ...release, labels: [], genres: [], formats: [], artists: [] } : release}
              streamingLinkEntries={prepareReleaseStreamingLinks(release)}
            />
          ) : null}
        </LayoutInset>
      </LayoutContainer>
    </QueryClientProvider>
  );
}
