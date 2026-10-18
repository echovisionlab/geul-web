import { getTranslations } from 'next-intl/server';
import { type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { PostsPageView } from '@/features/admin/post/PostsPageView';
import { listPostsAdmin } from '@/lib/queries/post';
import { toPaginatedListInput } from '@/lib/types/common/query';
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

  const result = await listPostsAdmin(toPaginatedListInput(query));

  return (
    <PostsPageView
      title={postsLabel}
      result={result}
      filterFields={filterFields}
      sortFields={sortFields}
      searchPlaceholder={tCommon('actions.searchItems', { items: postsLabel.toLowerCase() })}
      searchParams={params.toString()}
    />
  );
}
