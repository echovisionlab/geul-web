import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutContainer } from '@/components/core/Layout';
import { PostTaxonomyListPage } from '@/features/post/PostTaxonomyListPage';
import type { listPublishedPostsByTaxonomy } from '@/lib/queries/post-browser';
import { tableRows } from './fixtures/table-query';
const rows: Awaited<ReturnType<typeof listPublishedPostsByTaxonomy>>['data'] = [
  {
    id: 'post-1',
    title: 'Listening Notes',
    summary: undefined,
    slug: 'listening-notes',
    publishedAt: '2026-09-12T10:00:00Z',
    authors: [{ id: 'author-1', name: 'June Han' }],
  },
  {
    id: 'post-2',
    title: 'Night Signals',
    summary: undefined,
    slug: undefined,
    publishedAt: '2026-09-13T10:00:00Z',
    authors: [],
  },
];
export function PostTaxonomyPreview({
  kind = 'category',
  state = 'ready',
}: {
  kind?: 'category' | 'tag';
  state?: 'ready' | 'empty' | 'pending';
}) {
  const t = useTranslations('common.labels');
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide">
        <PostTaxonomyListPage
          kind={kind}
          taxonomyId="fixture-taxonomy"
          name={kind === 'category' ? 'Listening Notes' : 'Signal'}
          description={kind === 'category' ? t('description') : undefined}
          listAction={async ({ query }) =>
            state === 'pending'
              ? new Promise(() => {})
              : tableRows(
                  state === 'empty' ? [] : rows,
                  { ...query, page: query.page ?? 1, pageSize: query.pageSize ?? 20 },
                  (row) => row.title,
                  (row, key) => (key === 'published_at' ? row.publishedAt : key === 'title' ? row.title : undefined),
                )
          }
        />
      </LayoutContainer>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Public/Post Taxonomy',
  excludeStories: ['PostTaxonomyPreview'],
  component: PostTaxonomyPreview,
  args: { kind: 'category', state: 'ready' },
  render: (args) => <PostTaxonomyPreview key={`${args.kind}-${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Actual PostTaxonomyListPage used by both /category/[slug] and /tag/[slug], including production title/authors/date columns, search, multi-filter/multi-sort and pagination. Local typed list transport implements text search, scalar filters/sort and paging. Taxonomy resolution/notFound, metadata JSON-LD, route shell and backend filtering/permissions remain outside. Pending and empty branches are actual controller states.',
      },
    },
  },
} satisfies Meta<typeof PostTaxonomyPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Category: Story = {};
export const CategoryEmpty: Story = { args: { state: 'empty' } };
export const CategoryPending: Story = { args: { state: 'pending' } };
export const Tag: Story = { args: { kind: 'tag' } };
export const TagEmpty: Story = { args: { kind: 'tag', state: 'empty' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
