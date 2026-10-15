'use client';

import { Text as DsText } from '@/components/core/Typography';
import { useTranslations } from 'next-intl';

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
        <DsText size="sm" weight="medium">
          {row.name}
        </DsText>
      ),
    },
    {
      key: 'slug',
      header: labels.slug,
      cell: (row) => (
        <DsText size="sm" tone="secondary">
          {row.slug}
        </DsText>
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
  deleteAction?: typeof deleteFormatAction;
  result: ServerDataTableSelectableSectionProps<FormatRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<FormatRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<FormatRow>['sortFields'];
}

export function FormatsTableContent({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  deleteAction = deleteFormatAction,
}: FormatsTableContentProps) {
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
        deleteAction,
        getRowLabel: (row) => row.name || row.slug || row.id,
      }}
    />
  );
}
