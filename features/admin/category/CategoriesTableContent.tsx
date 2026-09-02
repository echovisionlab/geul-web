'use client';

import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
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
          <Text size="sm" fw={500}>
            {row.name}
          </Text>
          <Text size="xs" c="dimmed">
            /{row.slug || '-'}
          </Text>
        </div>
      ),
    },
    {
      key: 'description',
      header: labels.description,
      cell: (row) => (
        <Text size="sm" c="dimmed" lineClamp={1}>
          {row.description || '-'}
        </Text>
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
      cell: (row) => <CategoryRowMenu category={row} />,
    },
  ];
}

interface CategoriesTableContentProps {
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
        deleteAction: deleteCategoryAction,
        getRowLabel: (row) => row.name || row.slug || row.id,
      }}
    />
  );
}
