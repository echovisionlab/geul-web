'use client';

import { Fragment } from 'react';
import { useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
import { DateTime } from '@/features/date-time/DateTime';
import { TextButton } from '@/components/core/TextButton';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import type { PublicPostTableRow } from '@/lib/queries/post';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';

interface UserPublishedPostsTableContentProps {
  result: PaginatedQueryResult<PublicPostTableRow>;
  emptyMessage: string;
}

function renderTaxonomyLinks(items: { id: string; name: string; slug: string | null }[], type: 'category' | 'tag') {
  if (items.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        -
      </Text>
    );
  }

  return (
    <Text size="xs">
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {index > 0 ? ' / ' : null}
          {item.slug ? (
            <TextButton
              href={`/${type}/${encodeURIComponent(item.slug)}`}
              appearance="default"
              size="xs"
              display="inline"
            >
              {item.name}
            </TextButton>
          ) : (
            <Text span c="inherit" inherit>
              {item.name}
            </Text>
          )}
        </Fragment>
      ))}
    </Text>
  );
}

function getColumns(labels: {
  title: string;
  untitled: string;
  category: string;
  tag: string;
  published: string;
}): ColumnDef<PublicPostTableRow>[] {
  return [
    {
      key: 'title',
      header: labels.title,
      sortable: true,
      cell: (row) => (
        <Stack gap={2}>
          <TextButton href={`/posts/${row.slug || row.id}`} appearance="default" size="sm" weight="medium">
            {row.title || labels.untitled}
          </TextButton>
        </Stack>
      ),
    },
    {
      key: 'categories',
      header: labels.category,
      cell: (row) => renderTaxonomyLinks(row.categories, 'category'),
    },
    {
      key: 'tags',
      header: labels.tag,
      cell: (row) => renderTaxonomyLinks(row.tags, 'tag'),
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

export function UserPublishedPostsTableContent({ result, emptyMessage }: UserPublishedPostsTableContentProps) {
  const tCommon = useTranslations('common');
  const columns = getColumns({
    title: tCommon('labels.title'),
    untitled: tCommon('states.untitled'),
    category: tCommon('entities.category'),
    tag: tCommon('entities.tag'),
    published: tCommon('labels.published'),
  });

  return (
    <ServerDataTable.Content
      columns={columns}
      result={result}
      getRowKey={(row) => row.id}
      emptyMessage={emptyMessage}
      reservedRowCount={result.pageSize}
      highlightOnHover
    />
  );
}
