'use client';

import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { LabelBadge, StatusBadge } from '@/components/core/Badge';
import { TextButton } from '@/components/core/TextButton';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { deleteFormAction } from '@/lib/actions/form';
import { DateTime } from '@/features/date-time/DateTime';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { FormRowMenu } from './FormRowMenu';

interface FormRow {
  id: string;
  title: string;
  slug: string | undefined;
  status: string;
  submissionCount: number;
  createdAt: Date | undefined;
}

function getColumns(
  canDelete: boolean,
  tCommon: ReturnType<typeof useTranslations>,
  tCommonLabels: ReturnType<typeof useTranslations>,
): ColumnDef<FormRow>[] {
  return [
    {
      key: 'title',
      header: tCommonLabels('title'),
      cell: (row) => (
        <TextButton
          href={`/forms/${encodeURIComponent(row.id)}?edit=true`}
          size="sm"
          weight="medium"
          appearance="default"
        >
          {row.title}
        </TextButton>
      ),
    },
    {
      key: 'slug',
      header: tCommonLabels('slug'),
      cell: (row) => (
        <Text size="sm" c="dimmed">
          {row.slug ? `/${row.slug}` : '-'}
        </Text>
      ),
    },
    {
      key: 'status',
      header: tCommonLabels('status'),
      cell: (row) => (
        <StatusBadge appearance={row.status === 'draft' ? 'outline' : 'soft'} size="sm">
          {row.status === 'draft' ? tCommon('statuses.draft') : tCommon('statuses.published')}
        </StatusBadge>
      ),
    },
    {
      key: 'submissions',
      header: tCommonLabels('submissions'),
      cell: (row) => <LabelBadge size="sm">{row.submissionCount}</LabelBadge>,
    },
    {
      key: 'created',
      header: tCommonLabels('created'),
      cell: (row) => (
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
      cell: (row) => <FormRowMenu form={row} canDelete={canDelete} />,
    },
  ];
}

interface FormsTableContentProps {
  result: ServerDataTableSelectableSectionProps<FormRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<FormRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<FormRow>['sortFields'];
  basePath?: string;
  canDelete?: boolean;
}

export function FormsTableContent({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  basePath: _basePath = '/admin/forms',
  canDelete = true,
}: FormsTableContentProps) {
  const t = useTranslations('forms');
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const columns = getColumns(canDelete, tCommon, tCommonLabels);

  return (
    <ServerDataTableSelectableSection
      namespace="forms"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={t('empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      bulkDelete={
        canDelete
          ? {
              entityLabel: tCommonEntities('forms'),
              deleteAction: deleteFormAction,
              getRowLabel: (row) => row.title || row.slug || row.id,
            }
          : undefined
      }
    />
  );
}
