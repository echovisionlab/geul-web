'use client';

import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { deleteFormatAction } from '@/lib/actions/format';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { FormatRowMenu } from './FormatRowMenu';

interface FormatRow {
  id: string;
  name: string;
  slug: string;
  releaseCount: number;
}

function getColumns(labels: { format: string; slug: string; releases: string }): ColumnDef<FormatRow>[] {
  return [
    {
      key: 'name',
      header: labels.format,
      cell: (row) => (
        <Text size="sm" fw={500}>
          {row.name}
        </Text>
      ),
    },
    {
      key: 'slug',
      header: labels.slug,
      cell: (row) => (
        <Text size="sm" c="dimmed">
          {row.slug}
        </Text>
      ),
    },
    {
      key: 'releaseCount',
      header: labels.releases,
      cell: (row) => <LabelBadge size="sm">{row.releaseCount}</LabelBadge>,
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      cell: (row) => <FormatRowMenu format={row} />,
    },
  ];
}

interface FormatsTableContentProps {
  result: ServerDataTableSelectableSectionProps<FormatRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<FormatRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<FormatRow>['sortFields'];
}

export function FormatsTableContent({ result, searchPlaceholder, filterFields, sortFields }: FormatsTableContentProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tAdmin = useTranslations('adminList');
  const columns = getColumns({
    format: tCommon('entities.format'),
    slug: tCommon('labels.slug'),
    releases: tCommon('entities.releases'),
  });

  return (
    <ServerDataTableSelectableSection
      namespace="formats"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tAdmin('formats.empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      bulkDelete={{
        entityLabel: tCommonEntities('formats'),
        deleteAction: deleteFormatAction,
        getRowLabel: (row) => row.name || row.slug || row.id,
      }}
    />
  );
}
