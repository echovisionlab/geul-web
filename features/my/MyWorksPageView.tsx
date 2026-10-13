'use client';
import { SupportingText, Text as DsText, Heading as DsHeading } from '@/components/core/Typography';
import { LayoutInline as DsLayoutInline, LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Avatar } from '@/components/core/Display';
import { LabelBadge } from '@/components/core/Badge';
import { TextButton } from '@/components/core/TextButton';
import { DataTable } from '@/features/data-table/DataTable';
import type { FilterFieldConfig } from '@/features/data-table/DataTableMultiFilter';
import type { SortFieldConfig } from '@/features/data-table/DataTableMultiSort';
import { listMyCreditedWorksAction } from '@/lib/actions/work';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQuery } from '@/lib/types/common/query';
import type { CreditedWork } from '@/lib/types/work/model';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';

function CreditTypeBadge({
  creditType,
  tCommon,
}: {
  creditType: CreditedWork['creditType'];
  tCommon: ReturnType<typeof useTranslations>;
}) {
  switch (creditType) {
    case 'artist':
      return (
        <LabelBadge tone="neutral" size="sm">
          {tCommon('entities.artist')}
        </LabelBadge>
      );
    case 'member':
      return (
        <LabelBadge tone="neutral" size="sm">
          {tCommon('entities.user')}
        </LabelBadge>
      );
    default:
      return (
        <LabelBadge tone="neutral" size="sm">
          {tCommon('labels.name')}
        </LabelBadge>
      );
  }
}

function getCreditedColumns(
  tWorks: ReturnType<typeof useTranslations>,
  tCommon: ReturnType<typeof useTranslations>,
): ColumnDef<CreditedWork>[] {
  return [
    {
      key: 'title',
      header: tCommon('entities.work'),
      cell: (row) => (
        <TextButton href={`/works/${row.slug ?? row.id}`} size="sm" weight="medium" appearance="accent">
          {row.title || tCommon('states.untitled')}
        </TextButton>
      ),
    },
    {
      key: 'creditedAs',
      header: tWorks('columns.creditedAs'),
      cell: (row) => (
        <DsLayoutInline gap="xs">
          <Avatar
            src={buildManagedImageUrl(row.creditedAsImage, MANAGED_IMAGE_PRESET.AVATAR_SM)}
            size="sm"
            shape="circle"
            name={row.creditedAs}
          />
          <DsText size="sm">{row.creditedAs}</DsText>
        </DsLayoutInline>
      ),
    },
    {
      key: 'creditType',
      header: tWorks('columns.creditType'),
      cell: (row) => <CreditTypeBadge creditType={row.creditType} tCommon={tCommon} />,
    },
    {
      key: 'creditRole',
      header: tCommon('labels.role'),
      cell: (row) =>
        row.creditRole ? (
          <LabelBadge appearance="outline" size="sm">
            {row.creditRole}
          </LabelBadge>
        ) : (
          <SupportingText tone="secondary">{tCommon('states.none')}</SupportingText>
        ),
    },
  ];
}

export interface MyWorksPageViewProps {
  listAction?: typeof listMyCreditedWorksAction;
}
export function MyWorksPageView({ listAction = listMyCreditedWorksAction }: MyWorksPageViewProps = {}) {
  const tWorks = useTranslations('works');
  const tCommon = useTranslations('common');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const columns = getCreditedColumns(tWorks, tCommon);
  const filterFields: FilterFieldConfig[] = [
    { field: 'title', label: tCommon('labels.title'), type: 'string' },
    {
      field: 'type',
      label: tCommon('labels.type'),
      type: 'string',
      options: [
        { value: 'music_project', label: tWorks('types.music_project') },
        { value: 'portfolio', label: tWorks('types.portfolio') },
        { value: 'article', label: tWorks('types.article') },
        { value: 'contribution', label: tWorks('types.contribution') },
      ],
    },
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
  ];
  const sortFields: SortFieldConfig[] = [
    { field: 'title', label: tCommon('labels.title') },
    { field: 'type', label: tCommon('labels.type') },
    { field: 'created_at', label: tCommon('labels.created') },
  ];
  const [query, setQuery] = useState<PaginatedQuery>({ page: 1, pageSize: 20 });
  const loadedDataQuery = useQuery({
    queryKey: ['works', 'my', 'credited', query],
    queryFn: () =>
      listAction({
        filter: query.filters,
        filterBy: query.filterBy,
        sort: query.sorts?.map((sort) => ({ field: sort.field, order: sort.direction })),
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        search: query.search,
      }).then(unwrapQueryResult),
  });
  const { data, isLoading } = loadedDataQuery;

  if (loadedDataQuery.isError && loadedDataQuery.data === undefined) {
    return <QueryErrorAlert queries={[loadedDataQuery]} />;
  }
  return (
    <DsLayoutStack>
      <QueryErrorAlert queries={[loadedDataQuery]} />
      <DsHeading level={1} scale={2}>
        {tCommon('entities.works')}
      </DsHeading>
      <DataTable
        accessibleLabel={tCommon('entities.works')}
        columns={columns}
        result={data}
        loading={isLoading}
        query={query}
        getRowKey={(row) => row.creditId}
        onQueryChange={setQuery}
        emptyMessage={tWorks('emptyCredits')}
      >
        <DataTable.Toolbar>
          <DataTable.Search placeholder={tCommonPlaceholders('searchWorks')} />
          <DsLayoutInline gap="xxs">
            <DataTable.MultiFilter fields={filterFields} />
            <DataTable.MultiSort fields={sortFields} />
          </DsLayoutInline>
        </DataTable.Toolbar>
        <DataTable.Content />
        <DataTable.Pagination />
      </DataTable>
    </DsLayoutStack>
  );
}
