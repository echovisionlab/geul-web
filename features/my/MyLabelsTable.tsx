'use client';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useState } from 'react';
import { hashKey, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { MyLabelsDataTable, type MyLabelsDataTableResult } from '@/features/my/MyLabelsDataTable';
import { listMyLabelsAction } from '@/lib/actions/label';
import { toPaginatedListInput, type PaginatedQuery } from '@/lib/types/common/query';

interface MyLabelListItem {
  id: string;
  name: string;
  slug: string | null;
  imageLightUrl: string | null;
  imageDarkUrl: string | null;
  status: string;
  createdAt: Date | null;
}

interface MyLabelsResult {
  data: MyLabelListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface MyLabelsTableProps {
  listAction?: typeof listMyLabelsAction;
  initialData: MyLabelsResult;
}

const INITIAL_QUERY: PaginatedQuery = { page: 1, pageSize: 20 };
const initialQueryHash = hashKey([INITIAL_QUERY]);

/** Connects My Labels queries and localization to the table controller. */
export function MyLabelsTable({ initialData, listAction = listMyLabelsAction }: MyLabelsTableProps) {
  const t = useTranslations('myLabels');
  const tCommon = useTranslations('common');
  const dateTime = useDateTimeFormatter();
  const [query, setQuery] = useState<PaginatedQuery>(INITIAL_QUERY);

  const loadedDataQuery = useQuery({
    queryKey: ['labels', 'my', query],
    queryFn: () => listAction(toPaginatedListInput(query)).then(unwrapQueryResult),
    // The server-rendered page belongs to the first query only; another page or search must load its own rows.
    initialData: hashKey([query]) === initialQueryHash ? initialData : undefined,
  });
  const { data, isLoading } = loadedDataQuery;

  const result: MyLabelsDataTableResult | undefined = data && {
    ...data,
    data: data.data.map((label) => ({
      id: label.id,
      name: label.name,
      slugLabel: label.slug ? `/${label.slug}` : null,
      imageLightUrl: label.imageLightUrl,
      imageDarkUrl: label.imageDarkUrl,
      href: `/labels/${label.id}?edit=true`,
      statusLabel: label.status === 'published' ? tCommon('statuses.published') : tCommon('statuses.draft'),
      statusTone: label.status === 'published' ? 'positive' : 'neutral',
      createdLabel: label.createdAt ? dateTime.date(label.createdAt) : '-',
    })),
  };

  if (loadedDataQuery.isError && loadedDataQuery.data === undefined) {
    return <QueryErrorAlert queries={[loadedDataQuery]} />;
  }
  return (
    <>
      <QueryErrorAlert queries={[loadedDataQuery]} />
      <MyLabelsDataTable
        result={result}
        labels={{
          title: tCommon('entities.labels'),
          logo: tCommon('labels.image'),
          name: tCommon('labels.name'),
          status: tCommon('labels.status'),
          created: tCommon('labels.created'),
          empty: t('empty'),
          searchPlaceholder: t('searchPlaceholder'),
        }}
        query={query}
        loading={isLoading}
        onQueryChange={setQuery}
      />
    </>
  );
}
