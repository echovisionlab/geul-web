'use client';

import { Text } from '@mantine/core';
import { DateTime } from '@/features/date-time/DateTime';
import { TextButton } from '@/components/core/TextButton';
import type { PublicWorkTableRow } from '@/lib/queries/work';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { WORK_TYPE_LABELS, type WorkType } from '@/lib/types/work/model';

interface WorkTableColumnLabels {
  title: string;
  type: string;
  period: string;
  published: string;
  present: string;
}

function formatPeriod(row: PublicWorkTableRow, labels: WorkTableColumnLabels): string {
  const start = `${row.year}${row.month > 0 ? `.${String(row.month).padStart(2, '0')}` : ''}`;
  if (row.isPresent) {
    return `${start} - ${labels.present}`;
  }
  if (!row.untilYear) {
    return start;
  }

  const end = `${row.untilYear}${row.untilMonth ? `.${String(row.untilMonth).padStart(2, '0')}` : ''}`;
  return `${start} - ${end}`;
}

export function getWorkTableColumns(labels: WorkTableColumnLabels): ColumnDef<PublicWorkTableRow>[] {
  return [
    {
      key: 'title',
      header: labels.title,
      sortable: true,
      cell: (row) => (
        <TextButton href={`/works/${row.slug || row.id}`} size="md" weight="medium" appearance="default">
          {row.title}
        </TextButton>
      ),
    },
    {
      key: 'type',
      header: labels.type,
      cell: (row) => (
        <Text size="sm" c="dimmed">
          {WORK_TYPE_LABELS[row.type as WorkType] ?? row.type}
        </Text>
      ),
    },
    {
      key: 'period',
      header: labels.period,
      cell: (row) => (
        <Text size="sm" c="dimmed">
          {formatPeriod(row, labels)}
        </Text>
      ),
    },
    {
      key: 'publishedAt',
      header: labels.published,
      sortable: true,
      cell: (row) => (
        <Text size="sm" c="dimmed">
          <DateTime value={row.publishedAt} />
        </Text>
      ),
    },
  ];
}
