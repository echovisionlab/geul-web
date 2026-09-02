'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Avatar, Group, Stack, Text, Title } from '@mantine/core';
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
        <LabelBadge tone="accent" size="sm">
          {tCommon('entities.artist')}
        </LabelBadge>
      );
    case 'member':
      return (
        <LabelBadge tone="accent" size="sm">
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
        <Group gap="xs">
          <Avatar src={buildManagedImageUrl(row.creditedAsImage, MANAGED_IMAGE_PRESET.AVATAR_SM)} size="sm" radius="xl">
            {row.creditedAs.charAt(0).toUpperCase()}
          </Avatar>
          <Text size="sm">{row.creditedAs}</Text>
        </Group>
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
          <Text c="dimmed" size="sm">
            {tCommon('states.none')}
          </Text>
        ),
    },
  ];
}

export default function MyWorksPage() {
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
  const { data, isLoading } = useQuery({
    queryKey: ['works', 'my', 'credited', query],
    queryFn: () =>
      listMyCreditedWorksAction({
        filter: query.filters,
        filterBy: query.filterBy,
        sort: query.sorts?.map((sort) => ({ field: sort.field, order: sort.direction })),
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        search: query.search,
      }),
  });

  return (
    <Stack>
      <Title order={2}>{tCommon('entities.works')}</Title>
      <DataTable
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
          <Group gap={4}>
            <DataTable.MultiFilter fields={filterFields} />
            <DataTable.MultiSort fields={sortFields} />
          </Group>
        </DataTable.Toolbar>
        <DataTable.Content />
        <DataTable.Pagination />
      </DataTable>
    </Stack>
  );
}
