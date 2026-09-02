'use client';

import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { statusToneFromColor, StatusBadge } from '@/components/core/Badge';
import { TextButton } from '@/components/core/TextButton';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { DateTime } from '@/features/date-time/DateTime';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { CampaignRowMenu } from './CampaignRowMenu';

const STATUS_COLORS: Record<string, string> = {
  draft: 'gray',
  scheduled: 'blue',
  sending: 'yellow',
  sent: 'green',
  failed: 'red',
};

function translateCampaignStatus(
  status: string,
  labels: { draft: string; scheduled: string; sending: string; sent: string; failed: string },
): string {
  switch (status) {
    case 'draft':
      return labels.draft;
    case 'scheduled':
      return labels.scheduled;
    case 'sending':
      return labels.sending;
    case 'sent':
      return labels.sent;
    case 'failed':
      return labels.failed;
    default:
      return status;
  }
}

interface CampaignRow {
  id: string;
  name: string;
  subject: string;
  status: string;
  sentCount: number;
  createdAt: Date;
}

function getColumns(
  labels: {
    name: string;
    subject: string;
    status: string;
    sentCount: string;
    created: string;
    subjectFallback: string;
    statuses: { draft: string; scheduled: string; sending: string; sent: string; failed: string };
  },
  getRecipientsLabel: (count: number) => string,
): ColumnDef<CampaignRow>[] {
  return [
    {
      key: 'name',
      header: labels.name,
      cell: (row) => (
        <div>
          <TextButton href={`/campaigns/${row.id}?edit=true`} size="sm" weight="medium" appearance="default">
            {row.name || labels.subjectFallback}
          </TextButton>
          {row.subject && row.subject !== row.name ? (
            <Text size="xs" c="dimmed">
              {row.subject}
            </Text>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: labels.status,
      cell: (row) => (
        <StatusBadge tone={statusToneFromColor(STATUS_COLORS[row.status] || 'gray')} size="sm">
          {translateCampaignStatus(row.status, labels.statuses)}
        </StatusBadge>
      ),
    },
    {
      key: 'sentCount',
      header: labels.sentCount,
      cell: (row) => (
        <Text size="sm" c="dimmed">
          {row.sentCount > 0 ? getRecipientsLabel(row.sentCount) : '-'}
        </Text>
      ),
    },
    {
      key: 'createdAt',
      header: labels.created,
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
      cell: (row) => <CampaignRowMenu campaign={row} />,
    },
  ];
}

interface CampaignsTableContentProps {
  result: ServerDataTableSelectableSectionProps<CampaignRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<CampaignRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<CampaignRow>['sortFields'];
}

export function CampaignsTableContent({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
}: CampaignsTableContentProps) {
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminList.campaigns');
  const columns = getColumns(
    {
      name: tCommon('labels.name'),
      subject: tCommon('labels.subject'),
      status: tCommon('labels.status'),
      sentCount: tCommon('labels.sentCount'),
      created: tCommon('labels.created'),
      subjectFallback: tPage('subjectFallback'),
      statuses: {
        draft: tPage('statuses.draft'),
        scheduled: tPage('statuses.scheduled'),
        sending: tPage('statuses.sending'),
        sent: tPage('statuses.sent'),
        failed: tPage('statuses.failed'),
      },
    },
    (count) => tPage('recipients', { count }),
  );

  return (
    <ServerDataTableSelectableSection
      namespace="campaigns"
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
