'use client';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText, Heading as DsHeading } from '@/components/core/Typography';
import { useMemo, useState } from 'react';
import { hashKey, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { DateTime } from '@/features/date-time/DateTime';
import { TextButton } from '@/components/core/TextButton';
import { DataTable } from '@/features/data-table/DataTable';
import type { FilterFieldConfig } from '@/features/data-table/DataTableMultiFilter';
import type { SortFieldConfig } from '@/features/data-table/DataTableMultiSort';
import { UserInlineLinks } from '@/features/user/UserInlineLinks';
import { TAXONOMY_POSTS_INITIAL_QUERY } from '@/features/post/post-taxonomy-query';
import type { listPublishedPostsByTaxonomy } from '@/lib/queries/post-browser';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQuery } from '@/lib/types/common/query';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';

interface TaxonomyAuthor {
  id: string;
  name: string | null;
}

interface TaxonomyPostRow {
  id: string;
  title: string;
  slug: string | undefined;
  publishedAt: string | undefined;
  authors: TaxonomyAuthor[];
}

type TaxonomyKind = 'category' | 'tag';

interface PostTaxonomyListPageProps {
  listAction?: typeof listPublishedPostsByTaxonomy;
  kind: TaxonomyKind;
  taxonomyId: string;
  name: string;
  description?: string | null;
  /** Server-rendered result of `TAXONOMY_POSTS_INITIAL_QUERY`. */
  initialResult?: PaginatedQueryResult<TaxonomyPostRow>;
  initialResultUpdatedAt?: number;
}

const initialQueryHash = hashKey([TAXONOMY_POSTS_INITIAL_QUERY]);

// The server renders the first page; the browser RPC client loads when the visitor changes the query.
const listPublishedPostsByTaxonomyInBrowser: typeof listPublishedPostsByTaxonomy = async (input) =>
  (await import('@/lib/queries/post-browser')).listPublishedPostsByTaxonomy(input);

interface TaxonomyPostColumnLabels {
  title: string;
  author: string;
  published: string;
  untitled: string;
}

function getColumns(labels: TaxonomyPostColumnLabels): ColumnDef<TaxonomyPostRow>[] {
  return [
    {
      key: 'title',
      header: labels.title,
      cell: (row) => (
        <DsLayoutStack gap="xxs">
          <TextButton href={`/posts/${row.slug || row.id}`} size="sm" weight="medium" appearance="default">
            {row.title || labels.untitled}
          </TextButton>
        </DsLayoutStack>
      ),
    },
    {
      key: 'authors',
      header: labels.author,
      cell: (row) => {
        const namedAuthors = row.authors.filter((author): author is TaxonomyAuthor & { name: string } =>
          Boolean(author.name),
        );

        if (namedAuthors.length === 0) {
          return (
            <DsText size="sm" tone="secondary">
              -
            </DsText>
          );
        }

        return (
          <UserInlineLinks users={namedAuthors} unknownLabel="-" textSize="sm" showAvatars={false} separator="comma" />
        );
      },
    },
    {
      key: 'publishedAt',
      header: labels.published,
      cell: (row) => (
        <DsText size="sm" tone="secondary">
          <DateTime value={row.publishedAt} />
        </DsText>
      ),
    },
  ];
}

export function PostTaxonomyListPage({
  kind,
  taxonomyId,
  name,
  description,
  listAction = listPublishedPostsByTaxonomyInBrowser,
  initialResult,
  initialResultUpdatedAt,
}: PostTaxonomyListPageProps) {
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonMessages = useTranslations('common.messages');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tCommonStates = useTranslations('common.states');
  const taxonomyLabel = tCommonEntities(kind);
  const postsLabel = tCommonEntities('posts');
  const publishedLabel = tCommonLabels('published');
  const titleLabel = tCommonLabels('title');
  const columns = useMemo(
    () =>
      getColumns({
        title: titleLabel,
        author: tCommonLabels('author'),
        published: publishedLabel,
        untitled: tCommonStates('untitled'),
      }),
    [publishedLabel, tCommonLabels, tCommonStates, titleLabel],
  );
  const sortFields = useMemo<SortFieldConfig[]>(
    () => [
      { field: 'published_at', label: publishedLabel },
      { field: 'title', label: titleLabel },
    ],
    [publishedLabel, titleLabel],
  );
  const filterFields = useMemo<FilterFieldConfig[]>(
    () => [{ field: 'published_at', label: publishedLabel, type: 'date' }],
    [publishedLabel],
  );
  const [query, setQuery] = useState<PaginatedQuery>(TAXONOMY_POSTS_INITIAL_QUERY);

  const { data, isLoading } = useQuery({
    queryKey: ['posts', 'taxonomy', kind, taxonomyId, query],
    queryFn: () =>
      listAction({
        taxonomyType: kind,
        taxonomyId,
        query,
      }),
    initialData: hashKey([query]) === initialQueryHash ? initialResult : undefined,
    initialDataUpdatedAt: initialResultUpdatedAt,
  });

  return (
    <DsLayoutStack gap="md">
      <DsLayoutStack gap="xxs">
        <DsHeading level={1}>{name}</DsHeading>
        <DsText tone="secondary" size="sm">
          {taxonomyLabel} · {postsLabel}
        </DsText>
        {description && <DsText tone="secondary">{description}</DsText>}
      </DsLayoutStack>

      <DataTable
        columns={columns}
        result={data}
        loading={isLoading}
        query={query}
        getRowKey={(row) => row.id}
        onQueryChange={setQuery}
        emptyMessage={tCommonMessages('noPostsFound')}
      >
        <DataTable.Toolbar>
          <DataTable.Search placeholder={tCommonPlaceholders('searchPosts')} />
          <DsLayoutInline gap="xxs">
            <DataTable.MultiFilter fields={filterFields} />
            <DataTable.MultiSort fields={sortFields} />
          </DsLayoutInline>
        </DataTable.Toolbar>
        <DataTable.Content />
        <DataTable.Pagination />
      </DataTable>
    </DsLayoutStack>
  );
}
