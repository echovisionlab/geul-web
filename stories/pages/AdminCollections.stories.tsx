import { verifyAdminListControls } from './AdminListAccessibility';
import { transportRows } from './fixtures/transport-query';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { LayoutContainer } from '@/components/core/Layout';
import { ClientsPageView } from '@/features/admin/client/ClientsPageView';
import { SeriesPageView } from '@/features/admin/series/SeriesPageView';
import { WorksPageView } from '@/features/admin/work/WorksPageView';
import { ServerDataTableNavigationProvider } from '@/features/data-table/ServerDataTable/ServerDataTableNavigation';
import type { listWorksAdminAction } from '@/lib/actions/work';
import type { QueryValue } from '@/lib/api/query-result';
import { parseTableQuery } from '@/lib/utils/table-url';
import { tableRows } from './fixtures/table-query';
import { actionFailure, actionSuccess } from '@/lib/actions/action-result';
const date = new Date('2026-09-12T10:00:00Z');
const clients = [
  {
    id: 'client-1',
    name: 'Quiet Signal',
    website: 'https://example.com',
    logoUrl: null,
    logoLightUrl: null,
    logoDarkUrl: null,
    workCount: 3,
    createdAt: date,
  },
];
const series = [
  {
    id: 'series-1',
    title: 'Listening Notes',
    slug: 'listening-notes',
    postCount: 3,
    status: 'published',
    createdAt: date,
  },
  { id: 'series-2', title: 'First Draft', slug: undefined, postCount: 0, status: 'draft', createdAt: date },
];
const works: QueryValue<Awaited<ReturnType<typeof listWorksAdminAction>>>['data'] = [
  {
    id: 'work-1',
    title: 'Night Signals',
    slug: 'night-signals',
    type: 'music_project',
    featuredImageUrl: null,
    featured: true,
    status: 'published',
    creditCount: 2,
    clientCount: 1,
    createdAt: date,
    updatedAt: date,
  },
  {
    id: 'work-2',
    title: 'First Draft',
    slug: null,
    type: 'portfolio',
    featuredImageUrl: null,
    featured: false,
    status: 'draft',
    creditCount: 0,
    clientCount: 0,
    createdAt: date,
    updatedAt: date,
  },
];
export function AdminCollectionPagePreview({
  domain = 'clients',
  state = 'ready',
}: {
  domain?: 'clients' | 'series' | 'works';
  state?: 'ready' | 'empty' | 'error' | 'loading' | 'create-error';
}) {
  const t = useTranslations('common');
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  const [url, setUrl] = useState('');
  const [clientRows, setClientRows] = useState(state === 'empty' ? [] : clients);
  const [seriesRows, setSeriesRows] = useState(state === 'empty' ? [] : series);
  const [workRows] = useState(() => ({ current: state === 'empty' ? [] : works }));
  const params = new URLSearchParams(url),
    query = parseTableQuery(params, domain);
  const result = <T extends { id: string }>(rows: T[]) => ({
    ...tableRows(
      rows,
      query,
      (row) =>
        Object.values(row)
          .filter((v) => typeof v === 'string')
          .join(' '),
      (row, key) =>
        Object.entries(row).find(
          ([name]) => name === key || name.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`) === key,
        )?.[1],
    ),
    ...(state === 'error' ? { error: t('messages.failedToLoad') } : {}),
  });
  const fields = [
    {
      field: domain === 'clients' ? 'name' : 'title',
      label: t(domain === 'clients' ? 'labels.name' : 'labels.title'),
      type: 'string' as const,
    },
  ];
  const shared = {
    title: t(`entities.${domain}`),
    searchParams: params.toString(),
    searchPlaceholder: t('actions.searchItems', { items: t(`entities.${domain}`).toLowerCase() }),
    filterFields: fields,
    sortFields: fields.map(({ field, label }) => ({ field, label })),
  };
  return (
    <QueryClientProvider client={queryClient}>
      <ServerDataTableNavigationProvider
        value={{
          pathname: `/admin/${domain}`,
          searchParams: params,
          push: (href) => setUrl(new URL(href, 'https://preview.invalid').search),
          refresh: () => {},
        }}
      >
        <LayoutContainer size="wide">
          {domain === 'clients' ? (
            <ClientsPageView
              {...shared}
              result={result(clientRows)}
              createBindings={{
                createAction: async (name) => {
                  if (state === 'create-error') {
                    return actionFailure(t('messages.failedToLoad'), 'ACTION_FAILED');
                  }
                  setClientRows((rows) => [...rows, { ...clients[0], id: `client-${rows.length + 1}`, name }]);
                  return actionSuccess({ data: { id: 'local-client' } });
                },
                onCreated: () => {},
              }}
              deleteAction={async (id) => {
                setClientRows((rows) => rows.filter((row) => row.id !== id));
                return actionSuccess({ success: true as const });
              }}
              modalBindings={{
                deleteAction: async (id) => {
                  setClientRows((rows) => rows.filter((row) => row.id !== id));
                  return actionSuccess({ success: true as const });
                },
                onDeleted: () => {},
              }}
            />
          ) : domain === 'series' ? (
            <SeriesPageView
              {...shared}
              result={result(seriesRows)}
              deleteAction={async (id) => {
                setSeriesRows((rows) => rows.filter((row) => row.id !== id));
                return actionSuccess({ success: true as const });
              }}
              modalBindings={{
                createAction: async ({ title }) => {
                  if (state === 'create-error') {
                    return actionFailure(t('messages.failedToLoad'), 'ACTION_FAILED');
                  }
                  setSeriesRows((rows) => [...rows, { ...series[1], id: `series-${rows.length + 1}`, title }]);
                  return actionSuccess({ data: { id: 'local-series' } });
                },
                onCreated: () => {},
                deleteAction: async (id) => {
                  setSeriesRows((rows) => rows.filter((row) => row.id !== id));
                  return actionSuccess({ success: true as const });
                },
                onDeleted: () => {},
              }}
            />
          ) : (
            <WorksPageView
              listAction={async (input) =>
                state === 'loading'
                  ? new Promise(() => {})
                  : state === 'error'
                    ? { ok: false, status: 503, error: t('messages.failedToLoad') }
                    : {
                        ok: true,
                        value: transportRows(
                          workRows.current,
                          input,
                          (row) => `${row.title} ${row.type} ${row.status}`,
                        ),
                      }
              }
              createAction={async (data) => {
                if (state === 'create-error') {
                  return actionFailure(t('messages.failedToLoad'), 'ACTION_FAILED');
                }
                workRows.current = [
                  ...workRows.current,
                  { ...works[1], id: `work-${workRows.current.length + 1}`, title: data.title },
                ];
                return actionSuccess({ data: { id: 'local-work' } });
              }}
              deleteAction={async (id) => {
                workRows.current = workRows.current.filter((row) => row.id !== id);
                return actionSuccess({ success: true as const });
              }}
              onCreated={() => {}}
            />
          )}
        </LayoutContainer>
      </ServerDataTableNavigationProvider>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Collections',
  excludeStories: ['AdminCollectionPagePreview'],
  component: AdminCollectionPagePreview,
  args: { domain: 'clients', state: 'ready' },
  render: (args) => <AdminCollectionPagePreview key={`${args.domain}-${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/admin/clients' } },
    docs: {
      description: {
        component:
          'Production client, series and work lists with local creation, deletion, query filters, sorting and pagination. Navigation opens mapped Storybook editor previews.',
      },
    },
  },
} satisfies Meta<typeof AdminCollectionPagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Clients: Story = { tags: ['a11y-lists'], play: verifyAdminListControls };
export const ClientsEmpty: Story = { args: { state: 'empty' } };
export const ClientsError: Story = { args: { state: 'error' } };
export const ClientCreateFailed: Story = { args: { state: 'create-error' } };
export const Series: Story = { tags: ['a11y-lists'], play: verifyAdminListControls, args: { domain: 'series' } };
export const SeriesEmpty: Story = { args: { domain: 'series', state: 'empty' } };
export const SeriesCreateFailed: Story = { args: { domain: 'series', state: 'create-error' } };
export const Works: Story = { tags: ['a11y-lists'], play: verifyAdminListControls, args: { domain: 'works' } };
export const WorksEmpty: Story = { args: { domain: 'works', state: 'empty' } };
export const WorksLoading: Story = { args: { domain: 'works', state: 'loading' } };
export const WorksError: Story = { args: { domain: 'works', state: 'error' } };
export const Phone: Story = {
  tags: ['a11y-lists'],
  play: verifyAdminListControls,
  globals: { viewport: { value: 'phone', isRotated: false } },
};
