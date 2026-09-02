'use client';

import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { DateTime } from '@/features/date-time/DateTime';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { useLocale } from '@/lib/providers/LocaleProvider';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { AudienceSegmentRow } from './model';
import { SegmentRowMenu } from './SegmentRowMenu';

function getColumns(
  locale: string,
  labels: {
    name: string;
    type: string;
    status: string;
    active: string;
    archived: string;
    estimatedCount: string;
    created: string;
  },
): ColumnDef<AudienceSegmentRow>[] {
  return [
    {
      key: 'name',
      header: labels.name,
      cell: (row) => (
        <Text size="sm" fw={500}>
          {row.name}
        </Text>
      ),
    },
    {
      key: 'type',
      header: labels.type,
      cell: (row) => <LabelBadge size="sm">{row.segment_type_label}</LabelBadge>,
    },
    {
      key: 'status',
      header: labels.status,
      cell: (row) => (
        <LabelBadge tone={row.archived_at ? 'neutral' : 'positive'} size="sm">
          {row.archived_at ? labels.archived : labels.active}
        </LabelBadge>
      ),
    },
    {
      key: 'estimatedCount',
      header: labels.estimatedCount,
      cell: (row) => (
        <Text size="sm" c="dimmed">
          {row.estimated_count != null ? row.estimated_count.toLocaleString(locale) : '-'}
        </Text>
      ),
    },
    {
      key: 'createdAt',
      header: labels.created,
      cell: (row) => (
        <Text size="sm" c="dimmed">
          <DateTime value={row.created_at} />
        </Text>
      ),
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      cell: (row) => <SegmentRowMenu segment={row} />,
    },
  ];
}

interface SegmentsTableContentProps {
  result: ServerDataTableSelectableSectionProps<AudienceSegmentRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<AudienceSegmentRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<AudienceSegmentRow>['sortFields'];
}

export function SegmentsTableContent({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
}: SegmentsTableContentProps) {
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminList.audienceSegments');
  const locale = useLocale();
  const columns = getColumns(locale, {
    name: tCommon('labels.name'),
    type: tCommon('labels.type'),
    status: tCommon('labels.status'),
    active: tCommon('statuses.active'),
    archived: tCommon('statuses.archived'),
    estimatedCount: tCommon('labels.estimatedCount'),
    created: tCommon('labels.created'),
  });

  return (
    <ServerDataTableSelectableSection
      namespace="segments"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tPage('empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
    />
  );
}
