import type { Meta, StoryObj } from '@storybook/nextjs';
import { useLocale } from 'next-intl';
import { LayoutContainer } from '@/components/core/Layout';
import { WorkViewClient } from '@/app/(general)/works/[idOrSlug]/WorkViewClient';
import { ProgramEventViewClient } from '@/app/(general)/events/[idOrSlug]/ProgramEventViewClient';
import { PublicShellStoryHarness } from '@/stories/public/fixtures/PublicShellStoryHarness';
import { assertDocumentOutline } from '@/stories/public/fixtures/document-outline';
import {
  buildLongRichText,
  localizeLongSections,
  longRichTextLocale,
  NESTED_LONG_SECTIONS,
} from '@/stories/public/fixtures/long-rich-text';

/** The long body follows the review content language (Storybook locale `ko`/`ar`, else English). */
const longContents = new Map<string, ReturnType<typeof buildLongRichText>>();
function longContentFor(locale: string) {
  const key = longRichTextLocale(locale);
  if (!longContents.has(key)) {
    longContents.set(
      key,
      buildLongRichText(localizeLongSections(NESTED_LONG_SECTIONS.slice(0, 14), key), { firstId: 700, locale: key }),
    );
  }
  return longContents.get(key)!;
}

function PublicEntityPagePreview({
  entity = 'work',
  sparse = false,
  long = false,
  media = false,
}: {
  entity?: 'work' | 'event';
  sparse?: boolean;
  long?: boolean;
  media?: boolean;
}) {
  const locale = useLocale();
  const view = <PublicEntityView entity={entity} sparse={sparse} long={long} media={media} locale={locale} />;
  // Long documents use the production frame: the route renders directly in the site shell's main region.
  return long ? (
    <PublicShellStoryHarness initialPath={entity === 'work' ? '/works/night-signals' : '/events/listening-room'}>
      {view}
    </PublicShellStoryHarness>
  ) : (
    <LayoutContainer size="wide" inset="md">
      {view}
    </LayoutContainer>
  );
}

function PublicEntityView({
  entity,
  sparse,
  long,
  media,
  locale,
}: {
  entity: 'work' | 'event';
  sparse: boolean;
  long: boolean;
  media: boolean;
  locale: string;
}) {
  return (
    <>
      {entity === 'work' ? (
        <WorkViewClient
          work={{
            id: 'night-signals',
            slug: 'night-signals',
            title: 'Night Signals',
            type: 'music_project',
            year: 2026,
            month: 10,
            untilYear: null,
            untilMonth: null,
            isPresent: true,
            summary: sparse ? null : 'A program of spatial sound and field recordings.',
            featuredImageUrl: media ? '/storybook/media/video-poster.jpg' : null,
            metadata: {},
            content: long ? longContentFor(locale) : [],
            blockMedia: [],
            locationPlace: null,
            createdAt: new Date('2026-10-01T09:00:00Z'),
            updatedAt: new Date('2026-10-03T09:00:00Z'),
            publishedAt: new Date('2026-10-03T09:00:00Z'),
            credits: {
              groups: [],
              ungrouped: sparse
                ? []
                : [
                    {
                      id: 'credit-1',
                      name: 'Mina Park',
                      creditRole: 'Sound',
                      imageUrl: null,
                      artistId: null,
                      artistSlug: null,
                      memberId: null,
                    },
                  ],
            },
            clients: [],
            canEdit: false,
          }}
          pathname="/works/night-signals"
          requestedLocale={locale}
          musicLinkEntries={[]}
        />
      ) : (
        <ProgramEventViewClient
          event={{
            id: 'listening-room',
            slug: 'listening-room',
            title: 'Listening Room',
            summary: sparse ? null : 'Live electronics, field recordings, and collective listening.',
            content: long ? longContentFor(locale) : [],
            blockMedia: [],
            type: sparse ? null : { id: 'performance', slug: 'performance', name: 'Performance', description: null },
            series: sparse
              ? null
              : { id: 'night-signals', slug: 'night-signals', title: 'Night Signals', summary: null },
            startsAt: sparse ? null : new Date('2026-10-18T11:00:00Z'),
            endsAt: sparse ? null : new Date('2026-10-18T13:00:00Z'),
            timezone: 'Asia/Seoul',
            allDay: false,
            locationMode: sparse ? 'tba' : 'online',
            locationPlace: null,
            posterUrl: media ? '/storybook/media/event-poster.svg' : null,
            ticketUrl: sparse ? null : 'https://example.com/tickets',
            streamUrl: null,
            externalUrl: null,
            artists: [],
            labels: [],
            clients: [],
            credits: [],
            publishedAt: new Date('2026-10-01T09:00:00Z'),
            updatedAt: new Date('2026-10-03T09:00:00Z'),
          }}
          pathname="/events/listening-room"
          requestedLocale={locale}
          locale={locale}
        />
      )}
    </>
  );
}
const meta = {
  title: 'Pages/Public/Entity Detail',
  component: PublicEntityPagePreview,
  args: { entity: 'work', sparse: false },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Actual WorkViewClient and ProgramEventViewClient from their production App Router detail routes. Metadata, credits, links and responsive public header layout are real. Empty rich-text/media trees are deliberate fixtures; editor route, authorization, signed delivery, content-language server switching and SSR are outside these previews.',
      },
    },
  },
} satisfies Meta<typeof PublicEntityPagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Work: Story = {};
/** The featured image takes the start column; title, metadata and sections the rest of the width. */
export const WorkWithImage: Story = { args: { media: true } };
export const WorkSparse: Story = { args: { sparse: true } };
/** A long work document in the production site shell: outline column, rail and reading measure. */
export const WorkLongDocument: Story = { args: { long: true }, play: assertDocumentOutline };
export const WorkPhone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
export const Event: Story = { args: { entity: 'event' } };
/** The poster stays in view in the start column while the long description scrolls beside it. */
export const EventWithPoster: Story = { args: { entity: 'event', media: true, long: true } };
export const EventWithPosterPhone: Story = {
  args: { entity: 'event', media: true },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
export const EventSparse: Story = { args: { entity: 'event', sparse: true } };
/** A long event document in the production site shell: outline column, rail and reading measure. */
export const EventLongDocument: Story = { args: { entity: 'event', long: true }, play: assertDocumentOutline };
export const EventPhone: Story = {
  args: { entity: 'event' },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
