import { getTranslations } from 'next-intl/server';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable, type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { CreatePostButton, PostModalProvider, PostModals, PostsTableContent } from '@/features/admin/post';
import { listPostsAdmin } from '@/lib/queries/post';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminPostsPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const postsLabel = tCommon('entities.posts');
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'posts');
  const filterFields: FilterFieldConfig[] = [
    { field: 'title', label: tCommon('labels.title'), type: 'string' },
    { field: 'slug', label: tCommon('labels.slug'), type: 'string' },
    {
      field: 'status',
      label: tCommon('labels.status'),
      type: 'string',
      options: [
        { value: 'draft', label: tCommon('statuses.draft') },
        { value: 'published', label: tCommon('statuses.published') },
        { value: 'archived', label: tCommon('statuses.archived') },
      ],
    },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'title', label: tCommon('labels.title') },
    { field: 'status', label: tCommon('labels.status') },
    { field: 'created_at', label: tCommon('labels.created') },
    { field: 'updated_at', label: tCommon('labels.updated') },
  ];

  const result = await listPostsAdmin({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
    filter: query.filters,
    filterBy: query.filterBy,
  });

  return (
    <PostModalProvider>
      <AdminPageHeader
        title={postsLabel}
        items={[{ key: 'create-post', type: 'custom', content: <CreatePostButton /> }]}
      />

      <ServerDataTable namespace="posts">
        <PostsTableContent
          result={result}
          filterFields={filterFields}
          sortFields={sortFields}
          searchPlaceholder={tCommon('actions.searchItems', { items: postsLabel.toLowerCase() })}
        />
        <ServerDataTable.Pagination namespace="posts" result={result} searchParams={params} />
      </ServerDataTable>

      <PostModals />
    </PostModalProvider>
  );
}
