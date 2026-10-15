import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import { create } from '@bufbuild/protobuf';
import { useLocale } from 'next-intl';
import {
  ParagraphBlockSchema,
  ParagraphBlockLocaleSchema,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { FileDownloadAction, FileDownloadAvailability } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { LayoutContainer } from '@/components/core/Layout';
import { ArtistPublicView, type ArtistPublicViewProps } from '@/app/(general)/artists/[idOrSlug]/ArtistPublicView';
import { LabelPublicView, type LabelPublicViewProps } from '@/app/(general)/labels/[idOrSlug]/LabelPublicView';
import { prepareArtistPublicView } from '@/app/(general)/artists/[idOrSlug]/artist-public-prepared';
import { prepareLabelPublicView } from '@/app/(general)/labels/[idOrSlug]/label-public-prepared';
import { ReleasePublicView, type ReleasePublicViewProps } from '@/app/(general)/releases/[idOrSlug]/ReleasePublicView';
import { prepareReleaseStreamingLinks } from '@/app/(general)/releases/[idOrSlug]/release-streaming-links';
import { prepareSocialLinksDisplay } from '@/features/social-links/prepare-social-links-display';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';

export function PublicCatalogEntityPreview({
  entity = 'artist',
  sparse = false,
  fallback = false,
}: {
  entity?: 'artist' | 'label' | 'release';
  sparse?: boolean;
  fallback?: boolean;
}) {
  const locale = useLocale();
  const displayedLocale = fallback ? 'ko' : 'en';
  const localizationInfo = {
    requestedLocale: locale,
    displayedLocale,
    sourceLocale: displayedLocale,
    isFallback: locale !== displayedLocale,
    isOriginal: true,
    machineGenerated: false,
    fallbackReason: 0,
    availableLocales: [displayedLocale],
  };
  const content: readonly LocalizedRichTextBlock[] = sparse
    ? []
    : [
        {
          id: '10000000-0000-4000-8000-000000000301',
          kind: 'paragraph',
          base: create(ParagraphBlockSchema),
          locale: create(ParagraphBlockLocaleSchema, {
            content: [
              {
                value: {
                  case: 'text',
                  value: {
                    text: fallback
                      ? '공간의 소리를 기록하고 나누는 작업입니다.'
                      : 'Recording and sharing the sound of a place.',
                  },
                },
              },
            ],
          }),
          children: [],
        },
      ];
  const artist: ArtistPublicViewProps['artist'] = {
    id: 'mina',
    name: 'Mina Park',
    slug: 'mina-park',
    realName: null,
    content,
    countryCode: sparse ? null : 'KR',
    website: sparse ? null : 'https://example.com/mina',
    imageUrl: null,
    images: [],
    socialLinks: {},
    isGroup: false,
    localizationInfo,
    labels: sparse ? [] : [{ id: 'quiet', name: 'Quiet Records', slug: 'quiet-records' }],
    works: sparse
      ? []
      : [
          { id: 'night', title: 'Night Signals', slug: 'night-signals', type: 'music_project', featuredImageUrl: null },
          { id: 'room', title: 'Quiet Room', slug: 'quiet-room', type: 'portfolio', featuredImageUrl: null },
        ],
    releases: sparse
      ? []
      : [
          {
            id: 'signals',
            title: 'Night Signals',
            slug: 'night-signals',
            type: 'album',
            artworkUrl: null,
            releaseDate: new Date('2026-10-01T00:00:00Z'),
            artists: [{ id: 'mina', name: 'Mina Park', slug: 'mina-park' }],
          },
        ],
    tracks: sparse ? [] : [{ id: 'harbor', title: 'Harbor', roleName: 'Composer' }],
  };
  const label: LabelPublicViewProps['label'] = {
    id: 'quiet',
    name: 'Quiet Records',
    slug: 'quiet-records',
    descriptionText: null,
    content,
    ogImageUrl: null,
    imageUrl: null,
    imageLightUrl: null,
    imageDarkUrl: null,
    website: sparse ? null : 'https://example.com/quiet',
    countryCode: sparse ? null : 'KR',
    socialLinks: {},
    status: 'published',
    releaseCount: sparse ? 0 : 1,
    artistCount: sparse ? 0 : 1,
    parentLabel: null,
    artists: sparse ? [] : [{ id: 'mina', name: 'Mina Park', slug: 'mina-park', imageUrl: null }],
    releases: sparse
      ? []
      : [
          {
            id: 'signals',
            title: 'Night Signals',
            slug: 'night-signals',
            type: 'album',
            artworkUrl: null,
            releaseDate: new Date('2026-10-01T00:00:00Z'),
            publishedAt: new Date('2026-10-01T00:00:00Z'),
            artists: [{ id: 'mina', name: 'Mina Park', slug: 'mina-park' }],
          },
        ],
    createdAt: null,
    updatedAt: null,
    publishedAt: null,
    localizationInfo,
  };
  const release: ReleasePublicViewProps['release'] = {
    id: 'signals',
    title: 'Night Signals',
    slug: 'night-signals',
    type: 'album',
    descriptionText: null,
    content,
    artworkUrl: null,
    catalogNumber: sparse ? null : 'QR-001',
    releaseDate: sparse ? null : new Date('2026-10-01T00:00:00Z'),
    publishedAt: null,
    status: 'published',
    spotifyUrl: null,
    appleMusicUrl: null,
    bandcampUrl: null,
    youtubeMusicUrl: null,
    ogImageUrl: null,
    localizationInfo,
    labels: sparse ? [] : [{ id: 'quiet', name: 'Quiet Records', slug: 'quiet-records', catalogNumber: 'QR-001' }],
    genres: [],
    styles: [],
    formats: [],
    credits: [],
    artists: sparse ? [] : [{ id: 'mina', name: 'Mina Park', slug: 'mina-park', imageUrl: null, role: 'main' }],
    tracks: sparse
      ? []
      : ['Harbor', 'Quiet Room'].map((title, index) => ({
          id: `track-${index}`,
          title,
          trackNumber: index + 1,
          discNumber: null,
          durationMs: 125000,
          fileId: null,
          fileName: null,
          hlsUrl: null,
          downloadUrl: null,
          downloadExpiresAt: null,
          waveformUrl: null,
          spectrogramUrl: null,
          downloadAvailability: FileDownloadAvailability.UNSPECIFIED,
          downloadAction: FileDownloadAction.UNSPECIFIED,
          credits: [],
        })),
  };
  return (
    <LayoutContainer size="wide" inset="md">
      {entity === 'artist' ? (
        <ArtistPublicView
          artist={artist}
          artistMetadata={null}
          query={{}}
          requestedLocale={locale}
          uiLocale={locale}
          {...prepareArtistPublicView(artist, locale)}
          socialLinkEntries={prepareSocialLinksDisplay(artist.socialLinks ?? {})}
        />
      ) : entity === 'label' ? (
        <LabelPublicView
          label={label}
          labelMetadata={null}
          query={{}}
          requestedLocale={locale}
          uiLocale={locale}
          {...prepareLabelPublicView(label, locale)}
          socialLinkEntries={prepareSocialLinksDisplay(label.socialLinks ?? {})}
        />
      ) : (
        <ReleasePublicView
          release={release}
          releaseMetadata={null}
          query={{}}
          requestedLocale={locale}
          uiLocale={locale}
          streamingLinkEntries={prepareReleaseStreamingLinks(release)}
        />
      )}
    </LayoutContainer>
  );
}
const meta = {
  title: 'Pages/Public/Catalog Entity Detail',
  component: PublicCatalogEntityPreview,
  excludeStories: ['PublicCatalogEntityPreview'],
  args: { entity: 'artist', sparse: false, fallback: false },
  tags: ['a11y-public'],
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/artists/mina-park', query: {} } },
    docs: {
      description: {
        component:
          'Actual public artist, label and release owners with typed local documents and relationships. Source-language fallback reflects the authored body language. Track metadata without delivered files exercises the real unavailable-media branch; signed playback and download are covered by their media owners.',
      },
    },
  },
} satisfies Meta<typeof PublicCatalogEntityPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Artist: Story = {};
export const ArtistSparse: Story = { args: { sparse: true } };
export const Label: Story = { args: { entity: 'label' } };
export const LabelSparse: Story = { args: { entity: 'label', sparse: true } };
export const Release: Story = { args: { entity: 'release' } };
export const ReleaseSparse: Story = { args: { entity: 'release', sparse: true } };
export const SourceLanguageFallback: Story = {
  args: { entity: 'release', fallback: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent('Night Signals');
    await expect(
      (await canvas.findByText('공간의 소리를 기록하고 나누는 작업입니다.')).closest('[lang]'),
    ).toHaveAttribute('lang', 'ko');
    await expect(canvas.getByRole('group', { name: 'Harbor' })).toBeInTheDocument();
    await expect(canvas.getByRole('group', { name: 'Quiet Room' })).toBeInTheDocument();
  },
};
export const ArtistPhone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
