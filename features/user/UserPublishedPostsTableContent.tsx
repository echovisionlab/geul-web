'use client';

import { Text as DsText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Fragment } from 'react';
import { useTranslations } from 'next-intl';

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
      <DsText size="xs" tone="secondary">
        -
      </DsText>
    );
  }

  return (
    <DsText size="xs">
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
            <DsText as="span" tone="inherit">
              {item.name}
            </DsText>
          )}
        </Fragment>
      ))}
    </DsText>
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
        <DsLayoutStack gap="xxs">
          <TextButton href={`/posts/${row.slug || row.id}`} appearance="default" size="sm" weight="medium">
            {row.title || labels.untitled}
          </TextButton>
        </DsLayoutStack>
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
        <DsText size="sm" tone="secondary">
          <DateTime value={row.publishedAt} />
        </DsText>
      ),
    },
  ];
}

export function UserPublishedPostsTableContent({ result, emptyMessage }: UserPublishedPostsTableContentProps) {
  const tCommon = useTranslations('common');
  const tProfile = useTranslations('userProfile');
  const columns = getColumns({
    title: tCommon('labels.title'),
    untitled: tCommon('states.untitled'),
    category: tCommon('entities.category'),
    tag: tCommon('entities.tag'),
    published: tCommon('labels.published'),
  });

  return (
    <ServerDataTable.Content
      accessibleLabel={tProfile('sections.publishedPosts')}
      columns={columns}
      result={result}
      getRowKey={(row) => row.id}
      emptyMessage={emptyMessage}
      reservedRowCount={result.pageSize}
      highlightOnHover
    />
  );
}
