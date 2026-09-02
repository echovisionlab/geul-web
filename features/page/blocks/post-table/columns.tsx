'use client';

import { Stack, Text } from '@mantine/core';
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
        <Stack gap={2}>
          <TextButton href={`/posts/${row.slug || row.id}`} size="md" weight="medium" appearance="default">
            {row.title || labels.untitled}
          </TextButton>
        </Stack>
      ),
    },
    {
      key: 'authors',
      header: labels.authors,
      cell: (row) => (
        <Text size="sm" c="dimmed">
          {row.authors.length > 0 ? row.authors.map((author) => author.name || labels.unknown).join(', ') : '-'}
        </Text>
      ),
    },
    {
      key: 'categories',
      header: labels.categories,
      cell: (row) => (
        <Text size="sm" c="dimmed">
          {row.categories.length > 0 ? row.categories.map((category) => category.name).join(', ') : '-'}
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
