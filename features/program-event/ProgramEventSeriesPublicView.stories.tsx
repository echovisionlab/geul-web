import type { Meta, StoryObj } from '@storybook/nextjs';
import { Box } from '@mantine/core';

import { Button } from '@/components/core/Button';
import { EventSeriesEventsTableView, type EventSeriesEventsTableItem } from './EventSeriesEventsTableView';
import { ProgramEventSeriesPublicView } from './ProgramEventSeriesPublicView';

const SERIES_POSTER = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1120">
    <rect width="800" height="1120" fill="#17191d" />
    <circle cx="570" cy="330" r="205" fill="#c45135" />
    <path d="M0 940 280 530 535 940Z" fill="#e4c77d" />
    <text x="64" y="1020" fill="#f7f2e8" font-family="sans-serif" font-size="72">NIGHT SIGNALS</text>
  </svg>
`)}`;

const EVENT_POSTER = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 720">
    <rect width="480" height="720" fill="#1e5960" />
    <circle cx="240" cy="250" r="150" fill="#e5b756" />
  </svg>
`)}`;

const events: EventSeriesEventsTableItem[] = [
  {
    id: 'event-past',
    href: '/events/night-signals-opening',
    title: 'Night Signals: Opening Performance',
    summary: 'Live electronics, projected field recordings, and an artist talk.',
    typeName: 'Performance',
    startsAt: '2026-07-18T11:00:00.000Z',
    endsAt: '2026-07-18T13:00:00.000Z',
    timezone: 'Asia/Seoul',
    allDay: false,
    locationMode: 'map_place',
    posterUrl: EVENT_POSTER,
    publishedAt: '2026-06-01T09:00:00.000Z',
  },
  {
    id: 'event-upcoming',
    href: '/events/night-signals-listening-room',
    title: 'Night Signals: Listening Room',
    summary: 'An all-day spatial audio program available in the gallery and online.',
    typeName: 'Exhibition',
    startsAt: '2026-09-12T00:00:00.000Z',
    endsAt: null,
    timezone: 'Asia/Seoul',
    allDay: true,
    locationMode: 'hybrid',
    posterUrl: null,
    publishedAt: '2026-07-01T09:00:00.000Z',
  },
];

interface StoryViewProps {
  withPoster: boolean;
  empty: boolean;
  sparse: boolean;
  longTitle: boolean;
}

function StoryView({ withPoster, empty, sparse, longTitle }: StoryViewProps) {
  const storyEvents = empty ? [] : events;
  const title = longTitle
    ? 'Night Signals: A Continuing Program of Sound, Moving Image, Performance, and Collective Listening Across the City'
    : 'Night Signals';

  return (
    <Box
      data-testid="program-event-series-story-frame"
      w="min(1120px, 100%)"
      maw="calc(100vw - 2rem)"
      mx="auto"
      p="md"
      style={{ overflow: 'hidden' }}
    >
      <ProgramEventSeriesPublicView
        title={title}
        summary={sparse ? null : 'A global event-series summary shared by every locale.'}
        description={
          sparse
            ? null
            : 'Performances, installations, and listening sessions presented from July through September.\nThe series title and poster remain locale-neutral.'
        }
        posterUrl={withPoster ? SERIES_POSTER : null}
        controls={<Button size="xs">Share</Button>}
        eventsLabel="Events"
      >
        <EventSeriesEventsTableView
          result={{
            data: storyEvents,
            total: storyEvents.length,
            page: 1,
            pageSize: 10,
            totalPages: storyEvents.length > 0 ? 1 : 0,
          }}
          loading={false}
          query={{ page: 1, pageSize: 10 }}
          pageSize={10}
          locale="en-US"
          labels={{
            date: 'Date',
            event: 'Event',
            type: 'Type',
            location: 'Location',
            tba: 'To be announced',
            empty: 'No events found',
            searchPlaceholder: 'Search',
            showMore: (count) => `Show ${count} more`,
          }}
          locationLabels={{
            map_place: 'Venue',
            online: 'Online',
            hybrid: 'Hybrid',
            tba: 'To be announced',
          }}
          filterFields={[
            {
              field: 'type_id',
              label: 'Type',
              type: 'uuid',
              operators: ['in'],
              options: [
                { value: 'performance', label: 'Performance' },
                { value: 'exhibition', label: 'Exhibition' },
              ],
            },
            {
              field: 'location_mode',
              label: 'Location',
              type: 'string',
              operators: ['in'],
              options: [
                { value: 'map_place', label: 'Venue' },
                { value: 'online', label: 'Online' },
                { value: 'hybrid', label: 'Hybrid' },
                { value: 'tba', label: 'To be announced' },
              ],
            },
          ]}
          isLoadingMore={false}
          onQueryChange={() => {}}
          onLoadMore={() => {}}
        />
      </ProgramEventSeriesPublicView>
    </Box>
  );
}

const meta = {
  title: 'Feature/Program Event/Event Series Public View',
  component: StoryView,
  tags: ['program-event-series-public'],
  parameters: { layout: 'fullscreen' },
  args: {
    withPoster: true,
    empty: false,
    sparse: false,
    longTitle: false,
  },
  argTypes: {
    withPoster: {
      control: 'boolean',
      description: 'Render the one locale-neutral series poster.',
    },
    empty: {
      control: 'boolean',
      description: 'Render the production empty-events state.',
    },
    sparse: {
      control: 'boolean',
      description: 'Omit optional global summary and description.',
    },
    longTitle: {
      control: 'boolean',
      description: 'Use a title that exercises wrapping.',
    },
  },
} satisfies Meta<typeof StoryView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PosterAndEvents: Story = {};

export const NoPoster: Story = {
  args: { withPoster: false },
};

export const EmptyWithoutOptionalCopy: Story = {
  args: { withPoster: false, empty: true, sparse: true },
};

export const LongTitleNarrow: Story = {
  args: { withPoster: false, longTitle: true },
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};
