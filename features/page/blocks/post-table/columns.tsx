'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';

import { DateTime } from '@/features/date-time/DateTime';
import { TextButton } from '@/components/core/TextButton';
import type { PublicPostTableRow } from '@/lib/queries/post';
import type { ColumnDef } from '@/lib/types/common/data-table';

interface PostTableColumnLabels {
  title: string;
  authors: string;
  categories: string;
  published: string;
  untitled: string;
  unknown: string;
}

export function getPostTableColumns(labels: PostTableColumnLabels): ColumnDef<PublicPostTableRow>[] {
  return [
    {
      key: 'title',
      header: labels.title,
      sortable: true,
      cell: (row) => (
        <DsLayoutStack gap="xxs">
          <TextButton href={`/posts/${row.slug || row.id}`} size="md" weight="medium" appearance="default">
            {row.title || labels.untitled}
          </TextButton>
        </DsLayoutStack>
      ),
    },
    {
      key: 'authors',
      header: labels.authors,
      cell: (row) => (
        <DsText size="sm" tone="secondary">
          {row.authors.length > 0 ? row.authors.map((author) => author.name || labels.unknown).join(', ') : '-'}
        </DsText>
      ),
    },
    {
      key: 'categories',
      header: labels.categories,
      cell: (row) => (
        <DsText size="sm" tone="secondary">
          {row.categories.length > 0 ? row.categories.map((category) => category.name).join(', ') : '-'}
        </DsText>
      ),
    },
    {
      key: 'publishedAt',
      header: labels.published,
      sortable: true,
      cell: (row) => (
        <DsText size="sm" tone="secondary">
          <DateTime value={row.publishedAt} />
        </DsText>
      ),
    },
  ];
}
