'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Avatar, Group, Stack, Text } from '@mantine/core';
import { statusToneFromColor, StatusBadge } from '@/components/core/Badge';
import { DateTime } from '@/features/date-time/DateTime';
import { TextButton } from '@/components/core/TextButton';
import {
  ServerDataTableSelectableSection,
  type FilterFieldConfig,
  type SortFieldConfig,
} from '@/features/data-table/ServerDataTable';
import { deletePostAdminAction } from '@/lib/actions/post';
import { normalizeEnumToken } from '@/lib/i18n/admin-labels';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';
import { buildEntityEditHref } from '@/lib/utils/entity-edit-route';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { PostRowMenu } from './PostRowMenu';

const STATUS_COLORS: Record<string, string> = {
  draft: 'yellow',
  published: 'green',
  archived: 'gray',
};

interface PostRow {
  id: string;
  title: string;
  slug: string | undefined;
  status: string;
  createdAt: string | undefined;
  updatedAt: string | undefined;
  author?: {
    id: string;
    name: string | undefined;
    avatarUrl: string | undefined;
  };
}

function buildAuthorProfileHref(authorId: string) {
  return `/user/${authorId}`;
}

function getColumns(
  labels: {
    title: string;
    author: string;
    status: string;
    created: string;
    updated: string;
    untitled: string;
    user: string;
    unknownAuthor: string;
    draft: string;
    published: string;
    archived: string;
  },
  getViewProfileLabel: (name: string) => string,
): ColumnDef<PostRow>[] {
  return [
    {
      key: 'title',
      header: labels.title,
      cell: (row) => (
        <Stack gap={2}>
          <TextButton href={buildEntityEditHref(`/posts/${row.id}`, {})} size="sm" weight="medium" appearance="accent">
            {row.title || labels.untitled}
          </TextButton>
          {row.slug && (
            <Text size="xs" c="dimmed">
              /{row.slug}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: 'author',
      header: labels.author,
      cell: (row) => {
        if (!row.author) {
          return (
            <Text size="sm" c="dimmed">
              -
            </Text>
          );
        }

        const authorHref = buildAuthorProfileHref(row.author.id);

        return (
          <Group gap="xs" wrap="nowrap">
            <Link
              href={authorHref}
              style={{ display: 'inline-flex', textDecoration: 'none' }}
              aria-label={getViewProfileLabel(row.author.name || labels.user)}
            >
              <Avatar
                src={buildManagedImageUrl(row.author.avatarUrl, MANAGED_IMAGE_PRESET.AVATAR_SM)}
                size="sm"
                radius="xl"
              >
                {row.author.name?.charAt(0).toUpperCase()}
              </Avatar>
            </Link>
            <TextButton href={authorHref} size="sm" weight="medium" appearance="accent">
              {row.author.name || labels.unknownAuthor}
            </TextButton>
          </Group>
        );
      },
    },
    {
      key: 'status',
      header: labels.status,
      cell: (row) => (
        <StatusBadge tone={statusToneFromColor(STATUS_COLORS[normalizeEnumToken(row.status)] || 'blue')} size="sm">
          {normalizeEnumToken(row.status) === 'published'
            ? labels.published
            : normalizeEnumToken(row.status) === 'archived'
              ? labels.archived
              : normalizeEnumToken(row.status) === 'draft'
                ? labels.draft
                : row.status}
        </StatusBadge>
      ),
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
      key: 'updatedAt',
      header: labels.updated,
      cell: (row) => (
        <Text size="sm" c="dimmed">
          <DateTime value={row.updatedAt} />
        </Text>
      ),
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      cell: (row) => <PostRowMenu post={row} />,
    },
  ];
}

interface PostsTableContentProps {
  result: PaginatedQueryResult<PostRow>;
  filterFields: FilterFieldConfig[];
  sortFields: SortFieldConfig[];
  searchPlaceholder: string;
}

export function PostsTableContent({ result, filterFields, sortFields, searchPlaceholder }: PostsTableContentProps) {
  const tCommon = useTranslations('common');
  const tCommonAria = useTranslations('common.aria');
  const columns = getColumns(
    {
      title: tCommon('labels.title'),
      author: tCommon('labels.author'),
      status: tCommon('labels.status'),
      created: tCommon('labels.created'),
      updated: tCommon('labels.updated'),
      untitled: tCommon('states.untitled'),
      user: tCommon('entities.user'),
      unknownAuthor: tCommon('states.unknownAuthor'),
      draft: tCommon('statuses.draft'),
      published: tCommon('statuses.published'),
      archived: tCommon('statuses.archived'),
    },
    (name) => tCommonAria('viewProfile', { name }),
  );

  return (
    <ServerDataTableSelectableSection
      namespace="posts"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tCommon('messages.noPostsFound')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      bulkDelete={{
        entityLabel: tCommon('entities.posts'),
        deleteAction: deletePostAdminAction,
        getRowLabel: (row) => row.title || row.slug || row.id,
      }}
    />
  );
}
