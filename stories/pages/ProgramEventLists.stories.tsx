import { useState } from 'react';
import { navigatePreview } from '../shared/preview-navigation';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useTranslations } from 'next-intl';
import { LayoutContainer } from '@/components/core/Layout';
import { ProgramEventsPageView } from '@/features/admin/program-event/ProgramEventsPageView';
import { ProgramEventSeriesPageView } from '@/features/admin/program-event/ProgramEventSeriesPageView';
import type {
  AdminProgramEventListItem,
  AdminProgramEventSeriesListItem,
  AdminProgramEventTypeOption,
} from '@/lib/queries/program-event';
import { ServerDataTableNavigationProvider } from '@/features/data-table/ServerDataTable/ServerDataTableNavigation';
import { parseTableQuery } from '@/lib/utils/table-url';
import { tableRows } from './fixtures/table-query';
import { actionFailure, actionSuccess } from '@/lib/actions/action-result';
const date = new Date('2026-10-01T00:00:00Z');
const initialEvents: AdminProgramEventListItem[] = [
  {
    id: 'local-event',
    title: 'Night Signals · Listening room',
    slug: 'night-signals',
    status: 'published',
    typeId: 'local-event-type',
    seriesId: 'local-event-series',
    startsAt: date,
    endsAt: date,
    timezone: 'Asia/Seoul',
    locationMode: 'map_place',
    posterFileId: null,
    publishedAt: date,
    updatedAt: date,
  },
];
const initialSeries: AdminProgramEventSeriesListItem[] = [
  {
    id: 'local-event-series',
    title: 'Listening rooms',
    slug: 'listening-rooms',
    status: 'published',
    createdAt: date,
    updatedAt: date,
  },
];
const eventTypes: AdminProgramEventTypeOption[] = [
  {
    id: 'local-event-type',
    slug: 'listening-room',
    name: 'Listening room',
    status: 'active',
    sortOrder: 0,
    requiresPlace: true,
    requiresStreamUrl: false,
    locales: [
      { locale: 'en', name: 'Listening room', description: 'A shared listening session' },
      { locale: 'ko', name: '청음회', description: '함께 듣는 시간' },
    ],
  },
];
export function ProgramEventListsPreview({
  domain = 'events',
  state = 'ready',
}: {
  domain?: 'events' | 'eventSeries';
  state?: 'ready' | 'empty' | 'failed' | 'action-failed';
}) {
  const t = useTranslations('common');
  const [types, setTypes] = useState(eventTypes);
  const [events, setEvents] = useState(state === 'empty' ? [] : initialEvents);
  const [series, setSeries] = useState(state === 'empty' ? [] : initialSeries);
  const [url, setUrl] = useState('');
  const params = new URLSearchParams(url);
  const query = parseTableQuery(params, domain);
  const fields = [
    { field: 'title', label: t('labels.title'), type: 'string' as const },
    { field: 'status', label: t('labels.status'), type: 'string' as const },
  ];
  const result = <T extends { id: string; title: string }>(rows: T[]) => ({
    ...tableRows(
      rows,
      query,
      (row) => row.title,
      (row, key) => Object.entries(row).find(([k]) => k === key)?.[1],
    ),
    ...(state === 'failed' ? { error: t('messages.failedToLoad') } : {}),
  });
  const shared = {
    title: t(`entities.${domain === 'events' ? 'programEvents' : 'programEventSeries'}`),
    searchParams: params.toString(),
    filterFields: fields,
    sortFields: fields.map(({ field, label }) => ({ field, label })),
    searchPlaceholder: t('placeholders.search'),
  };
  return (
    <ServerDataTableNavigationProvider
      value={{
        pathname: `/admin/${domain === 'events' ? 'events' : 'event-series'}`,
        searchParams: params,
        push: (href) => setUrl(new URL(href, 'https://preview.invalid').search),
        refresh: () => {},
      }}
    >
      <LayoutContainer size="wide" inset="md">
        {domain === 'events' ? (
          <ProgramEventsPageView
            {...shared}
            result={result(events)}
            eventTypes={types}
            createBindings={{
              navigate: navigatePreview,
              createAction: async () => {
                if (state === 'action-failed') {
                  return actionFailure('Local creation failed', 'ACTION_FAILED');
                }
                const id = `local-event-${events.length}`;
                setEvents((rows) => [...rows, { ...initialEvents[0], id, status: 'draft' }]);
                return actionSuccess({ data: { id } });
              },
            }}
            deleteAction={async (id) => {
              if (state === 'action-failed') {
                return actionFailure('Local deletion failed', 'ACTION_FAILED');
              }
              setEvents((rows) => rows.filter((row) => row.id !== id));
              return actionSuccess({ success: true as const });
            }}
            typeBindings={{
              createProgramEventTypeAction: async (input) => {
                if (state === 'action-failed') {
                  return actionFailure('Local creation failed', 'ACTION_FAILED');
                }
                const item = {
                  ...eventTypes[0],
                  id: `local-type-${types.length + 1}`,
                  name: input?.name ?? 'New type',
                  slug: input?.slug ?? 'new-type',
                  locales: [],
                };
                setTypes((current) => [...current, item]);
                return actionSuccess({ data: { id: item.id, name: item.name, slug: item.slug } });
              },
              updateProgramEventTypeAction: async (id, input) => {
                if (state === 'action-failed') {
                  return actionFailure('Local update failed', 'ACTION_FAILED');
                }
                setTypes((current) => current.map((item) => (item.id === id ? { ...item, ...input } : item)));
                return actionSuccess({ success: true as const });
              },
              deleteProgramEventTypeAction: async (id) => {
                if (state === 'action-failed') {
                  return actionFailure('Local deletion failed', 'ACTION_FAILED');
                }
                setTypes((current) => current.filter((item) => item.id !== id));
                return actionSuccess({ success: true as const });
              },
            }}
          />
        ) : (
          <ProgramEventSeriesPageView
            {...shared}
            result={result(series)}
            createBindings={{
              navigate: navigatePreview,
              createAction: async () => {
                if (state === 'action-failed') {
                  return actionFailure('Local creation failed', 'ACTION_FAILED');
                }
                const id = `local-series-${series.length}`;
                setSeries((rows) => [...rows, { ...initialSeries[0], id, status: 'draft' }]);
                return actionSuccess({ data: { id } });
              },
            }}
            deleteAction={async (id) => {
              if (state === 'action-failed') {
                return actionFailure('Local deletion failed', 'ACTION_FAILED');
              }
              setSeries((rows) => rows.filter((row) => row.id !== id));
              return actionSuccess({ success: true as const });
            }}
          />
        )}
      </LayoutContainer>
    </ServerDataTableNavigationProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Program Event Lists',
  excludeStories: ['ProgramEventListsPreview'],
  component: ProgramEventListsPreview,
  args: { domain: 'events', state: 'ready' },
  render: (args) => <ProgramEventListsPreview key={`${args.domain}:${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Actual extracted production event/series PageViews, query tables, selection, creation and event type manager with typed local mutations. Fixtures support scalar query controls only; live service authorization, publication, relation constraints and edit destinations remain outside.',
      },
    },
  },
} satisfies Meta<typeof ProgramEventListsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Events: Story = {};
export const EventsEmpty: Story = { args: { state: 'empty' } };
export const EventsFailed: Story = { args: { state: 'failed' } };
export const EventsActionFailed: Story = { args: { state: 'action-failed' } };
export const Series: Story = { args: { domain: 'eventSeries' } };
export const SeriesEmpty: Story = { args: { domain: 'eventSeries', state: 'empty' } };
export const SeriesFailed: Story = { args: { domain: 'eventSeries', state: 'failed' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
