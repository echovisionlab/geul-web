'use client';

import { Text as DsText } from '@/components/core/Typography';
import { useTranslations } from 'next-intl';

import { LabelBadge } from '@/components/core/Badge';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { deleteTagAction } from '@/lib/actions/tag';
import { DateTime } from '@/features/date-time/DateTime';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { TagRowMenu } from './TagRowMenu';

interface TagRow {
  id: string;
  name: string;
  slug?: string;
  postCount: number;
  createdAt?: Date;
}

function getColumns(labels: { tag: string; posts: string; created: string }): ColumnDef<TagRow>[] {
  return [
    {
      key: 'name',
      header: labels.tag,
      cell: (row) => (
        <div>
          <DsText size="sm" weight="medium">
            {row.name}
          </DsText>
          <DsText size="xs" tone="secondary">
            /{row.slug || '-'}
          </DsText>
        </div>
      ),
    },
    {
      key: 'postCount',
      header: labels.posts,
      cell: (row) => <LabelBadge size="sm">{row.postCount}</LabelBadge>,
    },
    {
      key: 'createdAt',
      header: labels.created,
      cell: (row) => (
        <DsText size="sm" tone="secondary">
          <DateTime value={row.createdAt} />
        </DsText>
      ),
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      cell: (row) => <TagRowMenu tag={row} />,
    },
  ];
}

interface TagsTableContentProps {
  deleteAction?: typeof deleteTagAction;
  result: ServerDataTableSelectableSectionProps<TagRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<TagRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<TagRow>['sortFields'];
}

export function TagsTableContent({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  deleteAction = deleteTagAction,
}: TagsTableContentProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tAdmin = useTranslations('adminList');
  const columns = getColumns({
    tag: tCommon('entities.tag'),
    posts: tCommon('entities.posts'),
    created: tCommon('labels.created'),
  });

  return (
    <ServerDataTableSelectableSection
      namespace="tags"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tAdmin('tags.empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      bulkDelete={{
        entityLabel: tCommonEntities('tags'),
        deleteAction,
        getRowLabel: (row) => row.name || row.slug || row.id,
      }}
    />
  );
}
