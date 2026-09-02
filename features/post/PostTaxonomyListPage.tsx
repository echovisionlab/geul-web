'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Group, Stack, Text, Title } from '@mantine/core';
import { DateTime } from '@/features/date-time/DateTime';
import { TextButton } from '@/components/core/TextButton';
import { DataTable } from '@/features/data-table/DataTable';
import type { FilterFieldConfig } from '@/features/data-table/DataTableMultiFilter';
import type { SortFieldConfig } from '@/features/data-table/DataTableMultiSort';
import { UserInlineLinks } from '@/features/user/UserInlineLinks';
import { listPublishedPostsByTaxonomy } from '@/lib/queries/post-browser';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQuery } from '@/lib/types/common/query';

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
  kind: TaxonomyKind;
  taxonomyId: string;
  name: string;
  description?: string | null;
}

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
        <Stack gap={2}>
          <TextButton href={`/posts/${row.slug || row.id}`} size="sm" weight="medium" appearance="default">
            {row.title || labels.untitled}
          </TextButton>
        </Stack>
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
            <Text size="sm" c="dimmed">
              -
            </Text>
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
        <Text size="sm" c="dimmed">
          <DateTime value={row.publishedAt} />
        </Text>
      ),
    },
  ];
}

export function PostTaxonomyListPage({ kind, taxonomyId, name, description }: PostTaxonomyListPageProps) {
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
  const [query, setQuery] = useState<PaginatedQuery>({
    page: 1,
    pageSize: 20,
    sorts: [{ field: 'published_at', direction: 'desc' }],
  });

  const { data, isLoading } = useQuery({
    queryKey: ['posts', 'taxonomy', kind, taxonomyId, query],
    queryFn: () =>
      listPublishedPostsByTaxonomy({
        taxonomyType: kind,
        taxonomyId,
        query,
      }),
  });

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Title order={1}>{name}</Title>
        <Text c="dimmed" size="sm">
          {taxonomyLabel} · {postsLabel}
        </Text>
        {description && <Text c="dimmed">{description}</Text>}
      </Stack>

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
          <Group gap={4}>
            <DataTable.MultiFilter fields={filterFields} />
            <DataTable.MultiSort fields={sortFields} />
          </Group>
        </DataTable.Toolbar>
        <DataTable.Content />
        <DataTable.Pagination />
      </DataTable>
    </Stack>
  );
}
