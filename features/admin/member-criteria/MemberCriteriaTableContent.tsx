'use client';

import { Text as DsText } from '@/components/core/Typography';
import { useTranslations } from 'next-intl';

import { LabelBadge } from '@/components/core/Badge';
import { DateTime } from '@/features/date-time/DateTime';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { useLocale } from '@/lib/providers/LocaleProvider';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { MemberCriteriaRow } from './model';
import { MemberCriteriaRowMenu } from './MemberCriteriaRowMenu';
import { useMemberCriteriaKindLabel } from './useMemberCriteriaKindLabel';

function getColumns(
  locale: string,
  kindLabel: (kind: MemberCriteriaRow['criteria_type']) => string,
  labels: {
    name: string;
    type: string;
    status: string;
    active: string;
    archived: string;
    estimatedCount: string;
    created: string;
  },
): ColumnDef<MemberCriteriaRow>[] {
  return [
    {
      key: 'name',
      header: labels.name,
      cell: (row) => (
        <DsText size="sm" weight="medium">
          {row.name}
        </DsText>
      ),
    },
    {
      key: 'type',
      header: labels.type,
      cell: (row) => <LabelBadge size="sm">{kindLabel(row.criteria_type)}</LabelBadge>,
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
        <DsText size="sm" tone="secondary">
          {row.estimated_count != null ? row.estimated_count.toLocaleString(locale) : '-'}
        </DsText>
      ),
    },
    {
      key: 'createdAt',
      header: labels.created,
      cell: (row) => (
        <DsText size="sm" tone="secondary">
          <DateTime value={row.created_at} />
        </DsText>
      ),
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      cell: (row) => <MemberCriteriaRowMenu criteria={row} />,
    },
  ];
}

interface MemberCriteriaTableContentProps {
  result: ServerDataTableSelectableSectionProps<MemberCriteriaRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<MemberCriteriaRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<MemberCriteriaRow>['sortFields'];
}

export function MemberCriteriaTableContent({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
}: MemberCriteriaTableContentProps) {
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminList.memberCriteria');
  const locale = useLocale();
  const kindLabel = useMemberCriteriaKindLabel();
  const columns = getColumns(locale, kindLabel, {
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
      namespace="memberCriteria"
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
