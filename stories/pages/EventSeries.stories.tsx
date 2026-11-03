import { tableRows } from './fixtures/table-query';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { LayoutContainer } from '@/components/core/Layout';
import { ContentModal } from '@/components/core/Modal';
import { Text } from '@/components/core/Typography';
import { ProgramEventSeriesPublicView } from '@/features/program-event/ProgramEventSeriesPublicView';
import {
  EventSeriesEventsTableView,
  type EventSeriesEventsTableItem,
  type EventSeriesEventsQuery,
} from '@/features/program-event/EventSeriesEventsTableView';
const events: EventSeriesEventsTableItem[] = [
  {
    id: 'opening',
    href: '/events/opening',
    title: 'Opening performance',
    summary: 'Live electronics and field recordings.',
    typeName: 'Performance',
    startsAt: '2026-10-18T11:00:00Z',
    endsAt: '2026-10-18T13:00:00Z',
    timezone: 'Asia/Seoul',
    allDay: false,
    locationMode: 'map_place',
    posterUrl: null,
    publishedAt: '2026-10-01T09:00:00Z',
  },
  {
    id: 'listening',
    href: '/events/listening',
    title: 'Listening room',
    summary: 'Spatial audio in the gallery and online.',
    typeName: 'Exhibition',
    startsAt: '2026-10-25T00:00:00Z',
    endsAt: null,
    timezone: 'Asia/Seoul',
    allDay: true,
    locationMode: 'hybrid',
    posterUrl: null,
    publishedAt: '2026-10-01T09:00:00Z',
  },
];
function EventSeriesPagePreview({
  state = 'ready',
}: {
  state?: 'ready' | 'empty' | 'pending' | 'loading-more' | 'error';
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [query, setQuery] = useState<EventSeriesEventsQuery>({ page: 1, pageSize: 10 });
  const [share, setShare] = useState(false);
  const [count, setCount] = useState(1);
  const [loadMoreFailed, setLoadMoreFailed] = useState(state === 'error');
  const filtered = tableRows(
    state === 'empty' ? [] : events,
    { ...query, page: 1, pageSize: 100 },
    (row) => `${row.title} ${row.summary ?? ''}`,
    (row, key) =>
      key === 'location_mode'
        ? row.locationMode
        : key === 'starts_at'
          ? row.startsAt
          : key === 'published_at'
            ? row.publishedAt
            : key === 'type_id'
              ? row.typeName
              : row.title,
  ).data;
  const locationLabels = {
    map_place: t('programEventAdmin.locationModes.mapPlace'),
    online: t('programEventAdmin.locationModes.online'),
    hybrid: t('programEventAdmin.locationModes.hybrid'),
    tba: t('programEventAdmin.locationModes.tba'),
  };
  return (
    <LayoutContainer size="wide" inset="md">
      <ProgramEventSeriesPublicView
        title="Night Signals"
        description="Performances, installations, and collective listening."
        eventsLabel={t('common.entities.programEvents')}
        controls={<Button onClick={() => setShare(true)}>{t('common.actions.share')}</Button>}
      >
        <EventSeriesEventsTableView
          result={{
            data: filtered.slice(0, count),
            total: filtered.length,
            page: 1,
            pageSize: 10,
            totalPages: filtered.length ? 1 : 0,
          }}
          loading={state === 'pending'}
          query={query}
          pageSize={10}
          locale={locale}
          labels={{
            image: t('common.labels.image'),
            date: t('programEventAdmin.public.date'),
            event: t('common.labels.event'),
            type: t('common.labels.type'),
            location: t('common.labels.location'),
            tba: locationLabels.tba,
            empty: t('programEventAdmin.public.empty'),
            searchPlaceholder: t('common.placeholders.search'),
            showMore: (remaining) => t('shareLinks.showMore', { count: remaining }),
          }}
          locationLabels={locationLabels}
          filterFields={[
            {
              field: 'location_mode',
              label: t('common.labels.location'),
              type: 'string',
              options: Object.entries(locationLabels).map(([value, label]) => ({ value, label })),
            },
          ]}
          isLoadingMore={state === 'loading-more'}
          loadMoreDisabled={state === 'pending'}
          error={loadMoreFailed ? t('common.messages.failedToLoad') : null}
          onQueryChange={(value) => {
            setLoadMoreFailed(false);
            setCount(1);
            setQuery({
              ...value,
              filters: value.filters?.flatMap((filter) =>
                filter.field === 'type_id' || filter.field === 'location_mode'
                  ? [{ ...filter, field: filter.field }]
                  : [],
              ),
            });
          }}
          onLoadMore={() => {
            setLoadMoreFailed(false);
            setCount((value) => value + 10);
          }}
        />
      </ProgramEventSeriesPublicView>
      <ContentModal
        opened={share}
        onClose={() => setShare(false)}
        title={t('common.actions.share')}
        closeLabel={t('common.actions.close')}
      >
        <Text>/event-series/night-signals</Text>
      </ContentModal>
    </LayoutContainer>
  );
}
const meta = {
  title: 'Pages/Public/Event Series',
  component: EventSeriesPagePreview,
  args: { state: 'ready' },
  render: (args) => <EventSeriesPagePreview key={args.state} {...args} />,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Production public event-series page view plus production event table. Local search, filters, sorting, load-more and share dialog. Server query transport, edit-route branch, SSR, metadata and access checks are outside the adapter.',
      },
    },
  },
} satisfies Meta<typeof EventSeriesPagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Empty: Story = { args: { state: 'empty' } };
export const Loading: Story = { args: { state: 'pending' } };
export const LoadingMore: Story = { args: { state: 'loading-more' } };
export const LoadFailed: Story = { args: { state: 'error' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
