'use client';

import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { deleteStyleAction } from '@/lib/actions/style';
import { DateTime } from '@/features/date-time/DateTime';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { StyleRowMenu } from './StyleRowMenu';

interface StyleRow {
  id: string;
  name: string;
  slug: string;
  description?: string;
  releaseCount: number;
  createdAt?: Date;
}

interface StylesTableContentProps {
  result: ServerDataTableSelectableSectionProps<StyleRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<StyleRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<StyleRow>['sortFields'];
}

export function StylesTableContent({ result, searchPlaceholder, filterFields, sortFields }: StylesTableContentProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tAdmin = useTranslations('adminList');
  const columns = [
    {
      key: 'name',
      header: tCommon('entities.style'),
      cell: (row: StyleRow) => (
        <div>
          <Text size="sm" fw={500}>
            {row.name}
          </Text>
          <Text size="xs" c="dimmed">
            /{row.slug}
          </Text>
        </div>
      ),
    },
    {
      key: 'description',
      header: tCommon('labels.description'),
      cell: (row: StyleRow) => (
        <Text size="sm" c="dimmed" lineClamp={1}>
          {row.description || '-'}
        </Text>
      ),
    },
    {
      key: 'releaseCount',
      header: tCommon('entities.releases'),
      cell: (row: StyleRow) => <LabelBadge size="sm">{row.releaseCount}</LabelBadge>,
    },
    {
      key: 'createdAt',
      header: tCommon('labels.created'),
      cell: (row: StyleRow) => (
        <Text size="sm" c="dimmed">
          <DateTime value={row.createdAt} />
        </Text>
      ),
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      cell: (row: StyleRow) => <StyleRowMenu style={row} />,
    },
  ] satisfies ColumnDef<StyleRow>[];

  return (
    <ServerDataTableSelectableSection
      namespace="styles"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tAdmin('styles.empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      bulkDelete={{
        entityLabel: tCommonEntities('styles'),
        deleteAction: deleteStyleAction,
        getRowLabel: (row) => row.name || row.slug || row.id,
      }}
    />
  );
}
