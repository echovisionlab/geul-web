'use client';

import { Text as DsText } from '@/components/core/Typography';
import { useTranslations } from 'next-intl';

import { LabelBadge } from '@/components/core/Badge';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { deleteCategoryAction } from '@/lib/actions/category';
import { DateTime } from '@/features/date-time/DateTime';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { CategoryRowMenu } from './CategoryRowMenu';

interface CategoryRow {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  postCount: number;
  createdAt?: Date;
}

function getColumns(labels: {
  category: string;
  description: string;
  posts: string;
  created: string;
}): ColumnDef<CategoryRow>[] {
  return [
    {
      key: 'name',
      header: labels.category,
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
      key: 'description',
      header: labels.description,
      cell: (row) => (
        <DsText size="sm" tone="secondary" lines={1}>
          {row.description || '-'}
        </DsText>
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
      cell: (row) => <CategoryRowMenu category={row} />,
    },
  ];
}

interface CategoriesTableContentProps {
  deleteAction?: typeof deleteCategoryAction;
  result: ServerDataTableSelectableSectionProps<CategoryRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<CategoryRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<CategoryRow>['sortFields'];
}

export function CategoriesTableContent({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  deleteAction = deleteCategoryAction,
}: CategoriesTableContentProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tAdmin = useTranslations('adminList');
  const columns = getColumns({
    category: tCommon('entities.category'),
    description: tCommon('labels.description'),
    posts: tCommon('entities.posts'),
    created: tCommon('labels.created'),
  });

  return (
    <ServerDataTableSelectableSection
      namespace="categories"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tAdmin('categories.empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      bulkDelete={{
        entityLabel: tCommonEntities('categories'),
        deleteAction,
        getRowLabel: (row) => row.name || row.slug || row.id,
      }}
    />
  );
}
