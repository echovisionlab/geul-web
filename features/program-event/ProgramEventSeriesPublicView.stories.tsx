import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { useLocale, useTranslations } from 'next-intl';

import {
  EventSeriesEventsTableView,
  type EventSeriesEventsTableItem,
  type EventSeriesEventsQuery,
} from './EventSeriesEventsTableView';
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
  const t = useTranslations();
  const locale = useLocale();
  const locationLabels = {
    map_place: t('programEventAdmin.locationModes.mapPlace'),
    online: t('programEventAdmin.locationModes.online'),
    hybrid: t('programEventAdmin.locationModes.hybrid'),
    tba: t('programEventAdmin.locationModes.tba'),
  };
  const [query, setQuery] = useState<EventSeriesEventsQuery>({ page: 1, pageSize: 10 });
  const storyEvents = (empty ? [] : events).filter((event) => {
    if (query.search && !`${event.title} ${event.summary ?? ''}`.toLowerCase().includes(query.search.toLowerCase())) {
      return false;
    }
    const matches = (query.filters ?? []).map((filter) => {
      const value = filter.field === 'type_id' ? event.typeName?.toLowerCase() : event.locationMode;
      return Array.isArray(filter.value) ? filter.value.includes(value) : String(filter.value) === value;
    });
    return matches.length === 0 || (query.filterBy === 'OR' ? matches.some(Boolean) : matches.every(Boolean));
  });
  const title = longTitle
    ? 'Night Signals: A Continuing Program of Sound, Moving Image, Performance, and Collective Listening Across the City'
    : 'Night Signals';

  return (
    <div
      style={{
        ...{ overflow: 'hidden' },
        width: 'min(1120px, 100%)',
        maxWidth: 'calc(100vw - 2rem)',
        marginInline: 'auto',
        padding: 'var(--geul-spacing-md)',
      }}
      data-testid="program-event-series-story-frame"
    >
      <ProgramEventSeriesPublicView
        title={title}
        description={
          sparse
            ? null
            : 'Performances, installations, and listening sessions presented from July through September.\nThe series title and poster remain locale-neutral.'
        }
        posterUrl={withPoster ? SERIES_POSTER : null}
        eventsLabel={t('common.entities.programEvents')}
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
          query={query}
          pageSize={10}
          locale={locale}
          labels={{
            image: t('common.labels.image'),
            date: t('programEventAdmin.public.date'),
            event: t('common.labels.event'),
            type: t('common.labels.type'),
            location: t('common.labels.location'),
            tba: t('programEventAdmin.locationModes.tba'),
            empty: t('programEventAdmin.public.empty'),
            searchPlaceholder: t('common.placeholders.search'),
            showMore: (count) => t('shareLinks.showMore', { count }),
          }}
          locationLabels={locationLabels}
          filterFields={[
            {
              field: 'type_id',
              label: t('common.labels.type'),
              type: 'uuid',
              operators: ['in'],
              options: [
                { value: 'performance', label: 'Performance' },
                { value: 'exhibition', label: 'Exhibition' },
              ],
            },
            {
              field: 'location_mode',
              label: t('common.labels.location'),
              type: 'string',
              operators: ['in'],
              options: [
                { value: 'map_place', label: locationLabels.map_place },
                { value: 'online', label: locationLabels.online },
                { value: 'hybrid', label: locationLabels.hybrid },
                { value: 'tba', label: locationLabels.tba },
              ],
            },
          ]}
          isLoadingMore={false}
          onQueryChange={(value) => setQuery(value as EventSeriesEventsQuery)}
          onLoadMore={() => {}}
        />
      </ProgramEventSeriesPublicView>
    </div>
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
      description: 'Omit the optional global description.',
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
  globals: { viewport: { value: 'phone', isRotated: false } },
};

export const NarrowWithImage: Story = {
  args: { withPoster: true },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
