import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, waitFor } from 'storybook/test';

import { prepareSocialLinksDisplay } from '@/features/social-links/prepare-social-links-display';
import { LayoutContainer, LayoutInset, LayoutStack } from '@/components/core/Layout';
import { Heading, Text } from '@/components/core/Typography';
import { COLLECTION_SIZES, type CollectionSize } from '@/components/core/Collection';
import { withFeatureLabels } from '@/stories/feature-localization';

import { ArtistListViewClient, type ArtistListViewClientProps } from './artist-grid/ViewClientRuntime';
import { parseArtistListProps } from './artist-grid/schema';
import { AuthorListViewClient, type AuthorListViewClientProps } from './author-list/ViewClientRuntime';
import { parseAuthorListProps } from './author-list/schema';
import { LabelListViewClient, type LabelListViewClientProps } from './label-list/ViewClientRuntime';
import { parseLabelListProps } from './label-list/schema';
import { PostListViewClient, type PostListViewClientProps } from './post-list/ViewClientRuntime';
import { parsePostListProps } from './post-list/schema';
import {
  ProgramEventListViewClient,
  type ProgramEventListViewClientProps,
} from './program-event-list/ViewClientRuntime';
import { parseProgramEventListProps } from './program-event-list/schema';
import { ReleaseListViewClient, type ReleaseListViewClientProps } from './releases-gallery/ViewClientRuntime';
import { parseReleaseListProps } from './releases-gallery/schema';
import { WorkListViewClient, type WorkListViewClientProps } from './works-gallery/ViewClientRuntime';
import { parseWorkListProps } from './works-gallery/schema';
import type { ListViewLayout } from './ListViewShell';

type Entity = 'posts' | 'events' | 'artists' | 'releases' | 'works' | 'labels' | 'authors';
type ItemSize = CollectionSize;
type Fixture = 'editorial' | 'stress' | 'missing-media' | 'empty';

interface CollectionStoryProps {
  entity: Entity;
  layout: ListViewLayout;
  authorLayout: 'grid' | 'list';
  itemSize: ItemSize;
  fixture: Fixture;
  columns: '1' | '2' | '3' | '4';
  imageAspectRatio: '16:9' | '4:3' | '1:1' | 'auto';
  showImage: boolean;
  showMeta: boolean;
  carouselLoop: boolean;
  carouselIndicators: boolean;
  locale?: string;
  labels: Record<string, string>;
  /** Items shown (six by default). */
  limit?: number;
}

const entities: Entity[] = ['posts', 'events', 'artists', 'releases', 'works', 'labels', 'authors'];
const layouts: ListViewLayout[] = ['grid', 'list', 'cards', 'minimal', 'carousel'];
const sizes = COLLECTION_SIZES;
const poster = '/storybook/media/video-poster.jpg';
const studioLogo = '/storybook/media/example-studio-logo.svg';
const dsubLogo = '/storybook/media/dsub-logo.svg';

// These are authored editorial fixtures. UI labels and date/country formatting
// continue to follow Storybook's current locale, theme and direction globals.
const titles = {
  posts: [
    'Listening to the city after midnight',
    'A conversation about slow publishing, independent spaces and the places we return to',
    '기록되지 않은 소리들',
    'Between rehearsal and performance',
    'Small rooms, shared memories',
    'Notes from the archive',
  ],
  events: [
    'Open studio: listening room',
    'Independent publishing, performance and the future of the shared archive',
    '작은 방에서 만나는 새로운 음악',
    'Field recording workshop',
    'Night session / live broadcast',
    'Autumn conversations',
  ],
  artists: [
    'June Han',
    'The Ensemble for Unfinished Places and Everyday Sounds',
    '김서윤',
    'Mira Park',
    'Studio No. 4',
    'Quiet Signals',
  ],
  releases: [
    'Small Rooms',
    'The Long Way Home / Recordings from an Unfinished Landscape',
    '물결과 기억',
    'After Hours',
    'Field Notes Vol. 03',
    'First Light',
  ],
  works: [
    'Listening Atlas',
    'A collection of rooms, voices and overlooked histories from the edge of the city',
    '낮은 목소리의 풍경',
    'Open Score',
    'A shared archive',
    'Objects in motion',
  ],
  labels: [
    'Quiet Signals',
    'The Independent Archive for Music, Art and Moving Images',
    '기록실',
    'Example Studio',
    'rawsector',
    'Room Service',
  ],
  authors: [
    'June Han',
    'Alexandra Rivera / Independent Arts Correspondent',
    '김서윤',
    'Mira Park',
    'Sam Lee',
    'Nora Kim',
  ],
} satisfies Record<Entity, string[]>;

function imageFor(entity: Entity, index: number, fixture: Fixture): string | null {
  if (fixture === 'missing-media' || index === 2 || (fixture === 'stress' && index === 4)) {
    return null;
  }
  if (entity === 'labels') {
    return index % 2 ? dsubLogo : studioLogo;
  }
  return index === 5 ? studioLogo : poster;
}

function titleFor(entity: Entity, index: number, fixture: Fixture): string {
  const title = titles[entity][index];
  return fixture === 'stress' && index === 1
    ? `${title} — 서울에서 베를린까지, 우리가 함께 듣고 만들고 기록한 아주 긴 이야기`
    : title;
}

function renderCollection(props: CollectionStoryProps) {
  const { entity, fixture } = props;
  const indices = fixture === 'empty' ? [] : [0, 1, 2, 3, 4, 5].slice(0, props.limit ?? 6);
  const display = {
    layout: props.layout,
    itemSize: props.itemSize,
    columns: props.columns,
    imageAspectRatio: props.imageAspectRatio,
    showImage: String(props.showImage),
    showMeta: String(props.showMeta),
    carouselLoop: String(props.carouselLoop ?? true),
    carouselIndicators: String(props.carouselIndicators ?? true),
  };
  const itemFor = (index: number) => ({
    id: `${entity}-${index}`,
    href: `/${entity}/collection-example-${index}`,
    title: titleFor(entity, index, fixture),
    imageUrl: imageFor(entity, index, fixture),
    imageAlt: titles[entity][index],
  });

  switch (entity) {
    case 'posts': {
      const posts: PostListViewClientProps['posts'] = indices.map((index) => ({
        id: `post-${index}`,
        slug: `collection-example-${index}`,
        title: titleFor(entity, index, fixture),
        featured_image_url: imageFor(entity, index, fixture),
        published_at: index === 2 ? null : '2026-09-12T10:30:00Z',
        authors:
          index === 2
            ? []
            : [
                { id: 'june-han', name: 'June Han', image: poster },
                ...(index === 1
                  ? [
                      { id: 'mira-park', name: 'Mira Park', image: null },
                      { id: 'seoyun-kim', name: '김서윤', image: null },
                    ]
                  : []),
              ],
        categories: index === 2 ? [] : [{ id: 'journal', name: 'Journal', slug: 'journal' }],
        tags:
          index === 1
            ? [
                { id: 'independent-publishing', name: 'Independent publishing', slug: 'independent-publishing' },
                { id: 'archive', name: 'Archive', slug: 'archive' },
                { id: 'field-recording', name: 'Field recording', slug: 'field-recording' },
              ]
            : [],
      }));
      return (
        <PostListViewClient
          posts={posts}
          parsedProps={parsePostListProps({
            ...display,
            showFeaturedImage: String(props.showImage),
          })}
        />
      );
    }
    case 'events': {
      const events: ProgramEventListViewClientProps['events'] = indices.map((index) => ({
        ...itemFor(index),
        typeName: index === 2 ? null : index % 2 ? 'Workshop / conversation' : 'Live performance',
        startsAt: index === 2 ? null : `2026-10-${17 + index}T10:00:00Z`,
        endsAt: null,
        timezone: index === 4 ? 'Europe/Berlin' : 'Asia/Seoul',
        allDay: index === 3,
        locationMode: index === 4 ? 'online' : 'map_place',
      }));
      return (
        <ProgramEventListViewClient
          events={events}
          locale={props.locale}
          parsedProps={parseProgramEventListProps(display)}
        />
      );
    }
    case 'artists': {
      const artists = indices.map((index): ArtistListViewClientProps['artists'][number] => ({
        ...itemFor(index),
        socialLinkEntries: prepareSocialLinksDisplay(
          index === 2
            ? {}
            : index === 1
              ? {
                  website: 'https://example.org',
                  instagram: 'https://instagram.com/example',
                  bandcamp: 'https://example.bandcamp.com',
                  soundcloud: 'https://soundcloud.com/example',
                }
              : { website: 'https://example.org' },
        ),
      }));
      return <ArtistListViewClient artists={artists} parsedProps={parseArtistListProps(display)} />;
    }
    case 'releases': {
      const releases: ReleaseListViewClientProps['releases'] = indices.map((index) => ({
        ...itemFor(index),
        releaseDate: index === 2 ? null : '2026-09-12T00:00:00Z',
        mainArtists:
          index === 2
            ? []
            : [
                { id: 'june-han', label: 'June Han', href: '/artists/june-han' },
                ...(index === 1
                  ? [
                      { id: 'ensemble', label: 'The Ensemble for Unfinished Places', href: '/artists/ensemble' },
                      { id: 'mira-park', label: 'Mira Park', href: '/artists/mira-park' },
                    ]
                  : []),
              ],
      }));
      return <ReleaseListViewClient releases={releases} parsedProps={parseReleaseListProps(display)} />;
    }
    case 'works': {
      const types = ['music_project', 'portfolio', 'article', 'contribution'] as const;
      const works: WorkListViewClientProps['works'] = indices.map((index) => ({
        ...itemFor(index),
        type: types[index % types.length],
        publishedAt: index === 2 ? null : '2026-09-12T10:30:00Z',
      }));
      return <WorkListViewClient works={works} parsedProps={parseWorkListProps(display)} />;
    }
    case 'labels': {
      const labels: LabelListViewClientProps['labels'] = indices.map((index) => ({
        ...itemFor(index),
        countryCode: index === 2 ? null : ['KR', 'DE', 'KR', 'JP', 'US', 'GB'][index],
      }));
      return <LabelListViewClient labels={labels} parsedProps={parseLabelListProps(display)} />;
    }
    case 'authors': {
      const authors: AuthorListViewClientProps['authors'] = indices.map((index) => ({
        id: `author-${index}`,
        name: titleFor(entity, index, fixture),
        image: imageFor(entity, index, fixture),
        bio:
          index === 2
            ? null
            : index === 1
              ? 'Writer, editor and researcher working across music, independent publishing, architecture and collective memory. 서울과 베를린을 오가며 기록합니다.'
              : 'Writer and editor exploring music, places and shared memories.',
        post_count: index === 2 ? 0 : index === 1 ? 128 : 12,
      }));
      return (
        <AuthorListViewClient
          authors={authors}
          parsedProps={parseAuthorListProps({
            ...display,
            // Authors own grid/list layouts; do not manufacture unsupported states.
            layout: props.layout === 'list' ? 'list' : 'grid',
            showAvatar: String(props.showImage),
            showBio: String(props.showMeta),
          })}
        />
      );
    }
  }
}

function CollectionBlockPreview(props: CollectionStoryProps) {
  const preview = {
    ...props,
    layout: props.entity === 'authors' ? props.authorLayout : props.layout,
  };

  return (
    <LayoutContainer size="wide">
      <LayoutInset block="lg">
        <LayoutStack as="section" gap="md">
          <LayoutStack gap="xxs">
            <Heading level={2} scale={4}>
              {props.labels[preview.entity]}
            </Heading>
            <Text size="sm" tone="secondary">
              {props.labels[preview.layout]}
              {' · '}
              {props.labels[preview.itemSize]}
            </Text>
          </LayoutStack>
          {renderCollection(preview)}
        </LayoutStack>
      </LayoutInset>
    </LayoutContainer>
  );
}

/**
 * An events page as authors build it: an upcoming list above a past-events grid. One item size gives
 * both blocks the same image width, so a list block and a grid block sit together without a scale jump.
 */
function EventsPageComposition(props: CollectionStoryProps & { pastLayout: ListViewLayout }) {
  const section = (title: string, layout: ListViewLayout, limit: number) => (
    <LayoutStack as="section" gap="md">
      <Heading level={2} scale={3}>
        {title}
      </Heading>
      {renderCollection({ ...props, entity: 'events', layout, limit })}
    </LayoutStack>
  );
  return (
    <LayoutInset block="lg" inline="md">
      <LayoutStack gap="xl">
        {section(props.labels.upcoming, props.layout, 2)}
        {section(props.labels.past, props.pastLayout, 3)}
      </LayoutStack>
    </LayoutInset>
  );
}

const meta = {
  title: 'Feature/Page/Collection Blocks',
  component: CollectionBlockPreview,
  parameters: { layout: 'fullscreen' },
  decorators: [
    withFeatureLabels({
      localeProp: true,
      labels: {
        posts: 'pageEditor.sectionTypes.postList',
        events: 'pageEditor.sectionTypes.programEventList',
        artists: 'pageEditor.sectionTypes.artistGrid',
        releases: 'pageEditor.sectionTypes.releasesGallery',
        works: 'pageEditor.sectionTypes.worksGallery',
        labels: 'common.entities.labels',
        authors: 'pageEditor.sectionTypes.authorList',
        grid: 'pageEditor.blockEditor.options.layout.grid',
        list: 'pageEditor.blockEditor.options.layout.list',
        cards: 'pageEditor.blockEditor.options.layout.cards',
        minimal: 'pageEditor.blockEditor.options.layout.minimal',
        carousel: 'pageEditor.blockEditor.options.layout.carousel',
        xs: 'pageEditor.blockEditor.options.itemSize.xs',
        s: 'pageEditor.blockEditor.options.itemSize.s',
        m: 'pageEditor.blockEditor.options.itemSize.m',
        l: 'pageEditor.blockEditor.options.itemSize.l',
        xl: 'pageEditor.blockEditor.options.itemSize.xl',
        upcoming: 'pageEditor.blockEditor.options.timeWindow.upcoming',
        past: 'pageEditor.blockEditor.options.timeWindow.past',
      },
    }),
  ],
  args: {
    entity: 'posts',
    layout: 'grid',
    authorLayout: 'grid',
    itemSize: 'm',
    fixture: 'editorial',
    columns: '3',
    imageAspectRatio: '16:9',
    showImage: true,
    showMeta: true,
    carouselLoop: true,
    carouselIndicators: true,
    labels: {},
  },
  argTypes: {
    entity: { control: 'select', options: entities },
    layout: { control: 'select', options: layouts, if: { arg: 'entity', neq: 'authors' } },
    authorLayout: {
      name: 'layout',
      control: 'select',
      options: ['grid', 'list'],
      if: { arg: 'entity', eq: 'authors' },
    },
    itemSize: { control: 'inline-radio', options: sizes },
    fixture: { control: 'select', options: ['editorial', 'stress', 'missing-media', 'empty'] },
    // Grid columns follow the item size; the authored count is the carousel's slides per view.
    columns: { control: 'inline-radio', options: ['1', '2', '3', '4'], if: { arg: 'layout', eq: 'carousel' } },
    imageAspectRatio: {
      control: 'select',
      options: ['16:9', '4:3', '1:1', 'auto'],
      if: { arg: 'entity', neq: 'authors' },
    },
    carouselLoop: { control: 'boolean', if: { arg: 'layout', eq: 'carousel' } },
    carouselIndicators: { control: 'boolean', if: { arg: 'layout', eq: 'carousel' } },
    labels: { control: false, table: { disable: true } },
    locale: { control: false, table: { disable: true } },
  },
} satisfies Meta<typeof CollectionBlockPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Posts: Story = {};
export const Events: Story = { args: { entity: 'events' } };
export const Artists: Story = { args: { entity: 'artists', imageAspectRatio: '1:1' } };
export const Releases: Story = { args: { entity: 'releases', imageAspectRatio: '1:1', columns: '4' } };
export const Works: Story = { args: { entity: 'works' } };
export const Labels: Story = { args: { entity: 'labels', imageAspectRatio: '1:1' } };
export const Authors: Story = { args: { entity: 'authors' } };
// Keep the existing review URL while replacing forced comparison panels with one controlled preview.
export const SizeComparison: Story = { name: 'Playground', args: { layout: 'list' } };
export const LongContent: Story = { args: { fixture: 'stress', layout: 'cards' } };
export const MissingMedia: Story = { args: { fixture: 'missing-media' } };
export const Empty: Story = { args: { fixture: 'empty' } };
export const HeroCarousel: Story = { args: { layout: 'carousel', columns: '1', itemSize: 'l' } };

/** A list thumbnail is as wide as the grid card minimum and never shorter than its title and metadata. */
async function assertSharedMediaScale({ canvasElement }: { canvasElement: HTMLElement }) {
  await waitFor(() => expect(canvasElement.querySelectorAll('[data-width="thumbnail"]').length).toBeGreaterThan(0));
  for (const media of canvasElement.querySelectorAll<HTMLElement>('[data-width="thumbnail"]')) {
    const text = media.nextElementSibling as HTMLElement;
    expect(media.getBoundingClientRect().height).toBeGreaterThanOrEqual(text.getBoundingClientRect().height - 1);
  }
}

export const EventsPage: StoryObj<typeof EventsPageComposition> = {
  render: (args) => <EventsPageComposition {...args} />,
  args: { layout: 'list', pastLayout: 'grid' },
  argTypes: {
    layout: { name: 'upcoming layout', control: 'select', options: layouts },
    pastLayout: { name: 'past layout', control: 'select', options: layouts },
    entity: { table: { disable: true } },
    authorLayout: { table: { disable: true } },
  },
  play: assertSharedMediaScale,
};
export const EventsPageExtraSmall: StoryObj<typeof EventsPageComposition> = {
  ...EventsPage,
  args: { ...EventsPage.args, itemSize: 'xs' },
};
export const EventsPageSmall: StoryObj<typeof EventsPageComposition> = {
  ...EventsPage,
  args: { ...EventsPage.args, itemSize: 's' },
};
export const EventsPageLarge: StoryObj<typeof EventsPageComposition> = {
  ...EventsPage,
  args: { ...EventsPage.args, itemSize: 'l' },
};
export const EventsPageExtraLarge: StoryObj<typeof EventsPageComposition> = {
  ...EventsPage,
  args: { ...EventsPage.args, itemSize: 'xl' },
};
export const EventsPagePhone: StoryObj<typeof EventsPageComposition> = {
  ...EventsPage,
  globals: { viewport: { value: 'phone', isRotated: false } },
};
