import { unwrapQueryResult } from '@/lib/api/query-result';
import { getTranslations } from 'next-intl/server';
import { type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { TagsPageView } from '@/features/admin/tag/TagsPageView';
import { listTagsAdminAction } from '@/lib/actions/tag';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminTagsPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const tagsLabel = tCommon('entities.tags');
  const searchPlaceholder = tCommon('actions.searchItems', { items: tagsLabel.toLowerCase() });
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'tags');
  const filterFields: FilterFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name'), type: 'string' },
    { field: 'slug', label: tCommon('labels.slug'), type: 'string' },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name') },
    { field: 'postCount', label: tCommon('entities.posts') },
    { field: 'created_at', label: tCommon('labels.created') },
  ];

  const result = unwrapQueryResult(
    await listTagsAdminAction({
      filter: query.filters as never,
      filterBy: (query.filterBy || 'AND') as 'AND' | 'OR',
      sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
    }),
  );

  return (
    <TagsPageView
      title={tagsLabel}
      result={result}
      filterFields={filterFields}
      sortFields={sortFields}
      searchPlaceholder={searchPlaceholder}
      searchParams={params.toString()}
    />
  );
}
