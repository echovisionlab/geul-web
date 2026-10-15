import { transportRows } from './fixtures/transport-query';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { LayoutContainer, LayoutStack } from '@/components/core/Layout';
import { Alert } from '@/components/core/Alert';
import { MyArtistsTable } from '@/features/my/MyArtistsTable';
import { MyWorksPageView } from '@/features/my/MyWorksPageView';
import { MyPostsPageView } from '@/features/my/MyPostsPageView';
import { MySeriesPageView } from '@/features/my/MySeriesPageView';
import type { CreditedWork } from '@/lib/types/work/model';
import type { listMyPosts } from '@/lib/queries/post-browser';
import { actionSuccess } from '@/lib/actions/action-result';
import { pageRows } from './fixtures/paginated';
const artists = [
  {
    id: 'artist-1',
    name: 'June Han',
    slug: 'june-han',
    imageUrl: null,
    status: 'published',
    createdAt: new Date('2026-09-12T10:00:00Z'),
  },
  { id: 'artist-2', name: 'Night Signals', slug: null, imageUrl: null, status: 'draft', createdAt: null },
];
const works: CreditedWork[] = [
  {
    id: 'work-1',
    title: 'Night Signals',
    slug: 'night-signals',
    type: 'music_project',
    status: 'published',
    creditId: 'credit-1',
    creditRole: 'Composer',
    creditType: 'artist',
    creditedAs: 'June Han',
    creditedAsImage: null,
  },
];
const posts: Awaited<ReturnType<typeof listMyPosts>>['data'] = [
  {
    commentsEnabled: true,
    featuredImageUrl: null,
    publishedAt: undefined,
    author: undefined,
    authors: [],
    scheduledAt: undefined,
    scheduledTimeZone: undefined,
    allowedActions: [],
    categories: [],
    tags: [],
    series: undefined,
    seriesOrder: undefined,
    mapPlaceId: undefined,
    id: 'post-1',
    title: 'Listening notes',
    slug: 'listening-notes',
    summary: '',
    status: 'published',
    createdAt: '2026-09-12T10:00:00Z',
    updatedAt: '2026-09-12T10:00:00Z',
  },
  {
    commentsEnabled: false,
    featuredImageUrl: null,
    publishedAt: undefined,
    author: undefined,
    authors: [],
    scheduledAt: undefined,
    scheduledTimeZone: undefined,
    allowedActions: [],
    categories: [],
    tags: [],
    series: undefined,
    seriesOrder: undefined,
    mapPlaceId: undefined,
    id: 'post-2',
    title: 'A draft',
    slug: undefined,
    summary: undefined,
    status: 'draft',
    createdAt: undefined,
    updatedAt: undefined,
  },
];
const series = [
  {
    id: 'series-1',
    title: 'Listening notes',
    slug: 'listening-notes',
    status: 'published' as const,
    featuredImageUrl: null,
    ogImageUrl: null,
    sourceLocale: 'en',
    postCount: 4,
    managerCount: 2,
  },
];
export function MyListsPagePreview({
  domain = 'artists',
  state = 'ready',
}: {
  domain?: 'artists' | 'works' | 'posts' | 'series';
  state?: 'ready' | 'empty' | 'error' | 'pending';
}) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } }),
  );
  const [postRows] = useState(() => ({ current: state === 'empty' ? [] : posts }));
  const [created, setCreated] = useState(false);
  const t = useTranslations('common');
  const read = async <T extends { id: string }>(
    rows: readonly T[],
    query: {
      search?: string;
      page?: number;
      pageSize?: number;
      filter?: unknown;
      filterBy?: 'AND' | 'OR';
      sort?: Array<{ field: string; order?: 'asc' | 'desc' }>;
    },
    label: (row: T) => string,
  ) => {
    if (state === 'pending') {
      return new Promise<ReturnType<typeof pageRows<T>>>(() => {});
    }
    if (state === 'error') {
      throw new Error('Local query failure');
    }
    return transportRows(state === 'empty' ? [] : rows, query, label);
  };
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide">
        <LayoutStack gap="md">
          {created && <Alert tone="positive">{t('statuses.draft')}</Alert>}
          {domain === 'artists' ? (
            <MyArtistsTable
              initialData={pageRows(state === 'empty' ? [] : artists, { page: 1, pageSize: 20 }, (row) => row.name)}
              listAction={async (query) => ({ ok: true, value: await read(artists, query, (row) => row.name) })}
            />
          ) : domain === 'works' ? (
            <MyWorksPageView
              listAction={async (query) => ({ ok: true, value: await read(works, query, (row) => row.title) })}
            />
          ) : domain === 'posts' ? (
            <MyPostsPageView
              listAction={async (query) => read(postRows.current, query, (row) => row.title)}
              createBindings={{
                createAction: async () => {
                  const id = `local-post-${postRows.current.length + 1}`;
                  postRows.current = [
                    ...postRows.current,
                    { ...posts[1], id, title: t('actions.newItem', { item: t('entities.post') }) },
                  ];
                  return actionSuccess({ data: { id } });
                },
                onCreated: () => setCreated(true),
              }}
            />
          ) : (
            <MySeriesPageView items={state === 'empty' ? [] : series} />
          )}
        </LayoutStack>
      </LayoutContainer>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Account/Owned Lists',
  excludeStories: ['MyListsPagePreview'],
  component: MyListsPagePreview,
  args: { domain: 'artists', state: 'ready' },
  render: (args) => <MyListsPagePreview key={`${args.domain}-${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/my/artists' } },
    docs: {
      description: {
        component:
          'Production owned artist, work, post and series lists with local search, filters, sorting, pagination and post creation. Navigation opens mapped Storybook previews.',
      },
    },
  },
} satisfies Meta<typeof MyListsPagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Artists: Story = {};
export const ArtistsEmpty: Story = { args: { state: 'empty' } };
export const Works: Story = { args: { domain: 'works' } };
export const WorksEmpty: Story = { args: { domain: 'works', state: 'empty' } };
export const WorksFailed: Story = { args: { domain: 'works', state: 'error' } };
export const WorksLoading: Story = { args: { domain: 'works', state: 'pending' } };
export const Posts: Story = { args: { domain: 'posts' } };
export const PostsEmpty: Story = { args: { domain: 'posts', state: 'empty' } };
export const PostsLoading: Story = { args: { domain: 'posts', state: 'pending' } };
export const Series: Story = { args: { domain: 'series' } };
export const SeriesEmpty: Story = { args: { domain: 'series', state: 'empty' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
