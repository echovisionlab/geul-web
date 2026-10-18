'use client';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText, Heading as DsHeading } from '@/components/core/Typography';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { StatusBadge, type StatusBadgeTone } from '@/components/core/Badge';
import { DateTime } from '@/features/date-time/DateTime';
import { TextButton } from '@/components/core/TextButton';
import { DataTable } from '@/features/data-table/DataTable';
import type { FilterFieldConfig } from '@/features/data-table/DataTableMultiFilter';
import type { SortFieldConfig } from '@/features/data-table/DataTableMultiSort';
import { CreatePostButton } from '@/features/post/CreatePostButton';
import { listMyPosts } from '@/lib/queries/post-browser';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { toPaginatedListInput, type PaginatedQuery } from '@/lib/types/common/query';
import { buildEntityEditHref } from '@/lib/utils/entity-edit-route';

// Define the type to match the actual return type from listMyPostsAction (via toPlainPost)
// slug can be undefined from the proto layer
interface PostListItem {
  id: string;
  title: string;
  slug: string | undefined;
  summary: string | undefined;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  createdAt: string | undefined;
  updatedAt: string | undefined;
}

const STATUS_TONES: Record<PostListItem['status'], StatusBadgeTone> = {
  draft: 'neutral',
  scheduled: 'accent',
  published: 'positive',
  archived: 'neutral',
};

function getColumns(
  titleLabel: string,
  statusLabel: string,
  updatedLabel: string,
  untitledLabel: string,
  statusLabels: Record<PostListItem['status'], string>,
): ColumnDef<PostListItem>[] {
  return [
    {
      key: 'title',
      header: titleLabel,
      cell: (row) => (
        <DsLayoutStack gap="xxs">
          <TextButton href={buildEntityEditHref(`/posts/${row.id}`, {})} size="sm" weight="medium" appearance="accent">
            {row.title || untitledLabel}
          </TextButton>
          {row.slug && (
            <DsText size="xs" tone="secondary">
              /{row.slug}
            </DsText>
          )}
        </DsLayoutStack>
      ),
    },
    {
      key: 'status',
      header: statusLabel,
      cell: (row) => (
        <StatusBadge tone={STATUS_TONES[row.status]} size="sm">
          {statusLabels[row.status]}
        </StatusBadge>
      ),
    },
    {
      key: 'updatedAt',
      header: updatedLabel,
      cell: (row) => (
        <DsText size="sm" tone="secondary">
          <DateTime value={row.updatedAt} />
        </DsText>
      ),
    },
  ];
}

export interface MyPostsPageViewProps {
  listAction?: typeof listMyPosts;
  createBindings?: import('react').ComponentProps<typeof CreatePostButton>;
}
export function MyPostsPageView({ listAction = listMyPosts, createBindings }: MyPostsPageViewProps = {}) {
  const t = useTranslations('posts');
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const statusLabels: Record<PostListItem['status'], string> = {
    draft: tCommon('statuses.draft'),
    scheduled: tCommon('statuses.scheduled'),
    published: tCommon('statuses.published'),
    archived: tCommon('statuses.archived'),
  };
  const filterFields: FilterFieldConfig[] = [
    { field: 'title', label: tCommon('labels.title'), type: 'string' },
    {
      field: 'status',
      label: tCommon('labels.status'),
      type: 'string',
      options: [
        { value: 'draft', label: tCommon('statuses.draft') },
        { value: 'scheduled', label: tCommon('statuses.scheduled') },
        { value: 'published', label: tCommon('statuses.published') },
        { value: 'archived', label: tCommon('statuses.archived') },
      ],
    },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
    { field: 'updated_at', label: tCommon('labels.updated'), type: 'date' },
    { field: 'published_at', label: tCommon('labels.published'), type: 'date' },
  ];
  const sortFields: SortFieldConfig[] = [
    { field: 'title', label: tCommon('labels.title') },
    { field: 'created_at', label: tCommon('labels.created') },
    { field: 'updated_at', label: tCommon('labels.updated') },
    { field: 'published_at', label: tCommon('labels.published') },
  ];
  const columns = getColumns(
    tCommon('labels.title'),
    tCommon('labels.status'),
    tCommon('labels.updated'),
    tCommon('states.untitled'),
    statusLabels,
  );

  const [query, setQuery] = useState<PaginatedQuery>({
    page: 1,
    pageSize: 20,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['posts', 'my', query],
    queryFn: () => listAction(toPaginatedListInput(query)),
  });

  return (
    <DsLayoutStack>
      <DsLayoutInline justify="between">
        <DsHeading level={1} scale={2}>
          {tCommonEntities('posts')}
        </DsHeading>
        <CreatePostButton createAction={createBindings?.createAction} onCreated={createBindings?.onCreated} />
      </DsLayoutInline>

      <DataTable
        accessibleLabel={tCommonEntities('posts')}
        columns={columns}
        result={data}
        loading={isLoading}
        query={query}
        getRowKey={(row) => row.id}
        onQueryChange={setQuery}
        emptyMessage={t('empty')}
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
