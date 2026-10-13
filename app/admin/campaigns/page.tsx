import { CampaignsPageView } from '@/features/admin/campaign/CampaignsPageView';
import { unwrapQueryResult } from '@/lib/api/query-result';
import { getTranslations } from 'next-intl/server';
import { type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { listCampaignsAction } from '@/lib/actions/campaign';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminCampaignsPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const tCommonEntities = await getTranslations('common.entities');
  const tPage = await getTranslations('adminList.campaigns');
  const tCampaignStatuses = await getTranslations('adminList.campaigns.statuses');
  const searchPlaceholder = tPage('searchPlaceholder');
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'campaigns');
  const filterFields: FilterFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name'), type: 'string' },
    { field: 'subject', label: tCommon('labels.subject'), type: 'string' },
    {
      field: 'status',
      label: tCommon('labels.status'),
      type: 'string',
      options: [
        { value: 'draft', label: tCampaignStatuses('draft') },
        { value: 'scheduled', label: tCampaignStatuses('scheduled') },
        { value: 'sending', label: tCampaignStatuses('sending') },
        { value: 'sent', label: tCampaignStatuses('sent') },
        { value: 'failed', label: tCampaignStatuses('failed') },
      ],
    },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name') },
    { field: 'subject', label: tCommon('labels.subject') },
    { field: 'sentCount', label: tCommon('labels.sentCount') },
    { field: 'created_at', label: tCommon('labels.created') },
  ];

  const result = await listCampaignsAction({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
  }).then(unwrapQueryResult);

  return (
    <CampaignsPageView
      title={tCommonEntities('campaigns')}
      result={result}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      searchParams={params.toString()}
    />
  );
}
