import { getTranslations } from 'next-intl/server';
import { Box, Group, Text } from '@mantine/core';
import { getReservedTableContentMinHeight } from '@/components/core/DataTable';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { PageLoader } from '@/features/site/PageLoader';
import { InvalidPublicTableQueryError } from '@/lib/queries/public-table';
import { listPublicCategories, listPublicTags } from '@/lib/queries/taxonomy';
import { listUserPublishedPostsTable } from '@/lib/queries/user';
import type { PaginatedQuery } from '@/lib/types/common/query';
import { parseTableQuery } from '@/lib/utils/table-url';
import {
  buildUserPublishedPostsFilterFields,
  buildUserPublishedPostsSortFields,
} from './user-published-posts-table-spec';
import { UserPublishedPostsTableContent } from './UserPublishedPostsTableContent';

interface UserPublishedPostsTableProps {
  memberId: string;
  requestedLocale?: string | null;
  searchParams: URLSearchParams;
}

interface UserPublishedPostsTableFallbackProps {
  message?: string;
}

export async function UserPublishedPostsTable({
  memberId,
  requestedLocale,
  searchParams,
}: UserPublishedPostsTableProps) {
  const tCommon = await getTranslations('common');
  const tCommonPlaceholders = await getTranslations('common.placeholders');
  const tUserProfile = await getTranslations('userProfile');
  const query = parseTableQuery(searchParams, 'userPosts') as PaginatedQuery;
  const [categories, tags] = await Promise.all([listPublicCategories(), listPublicTags()]);
  const filterFields = buildUserPublishedPostsFilterFields(
    {
      categories: categories.map((category) => ({ value: category.id, label: category.name })),
      tags: tags.map((tag) => ({ value: tag.id, label: tag.name })),
    },
    {
      category: tCommon('entities.category'),
      tag: tCommon('entities.tag'),
    },
  );
  const sortFields = buildUserPublishedPostsSortFields({
    title: tCommon('labels.title'),
    published: tCommon('labels.published'),
  });

  let result: Awaited<ReturnType<typeof listUserPublishedPostsTable>>;
  let queryError: string | null = null;

  try {
    result = await listUserPublishedPostsTable(memberId, query, requestedLocale);
  } catch (error) {
    if (!(error instanceof InvalidPublicTableQueryError)) {
      throw error;
    }

    queryError = error.message;
    result = {
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    };
  }

  return (
    <ServerDataTable namespace="userPosts">
      <ServerDataTable.Toolbar>
        <ServerDataTable.Search namespace="userPosts" placeholder={tCommonPlaceholders('searchPosts')} />
        <Group gap={4}>
          <ServerDataTable.MultiFilter namespace="userPosts" fields={filterFields} allowLogicToggle={false} />
          <ServerDataTable.MultiSort namespace="userPosts" fields={sortFields} />
        </Group>
      </ServerDataTable.Toolbar>
      {queryError ? (
        <Text c="red">{queryError}</Text>
      ) : (
        <UserPublishedPostsTableContent result={result} emptyMessage={tUserProfile('empty.noPublishedPosts')} />
      )}
      <ServerDataTable.Pagination
        namespace="userPosts"
        result={result}
        searchParams={searchParams}
        reserveSpaceWhenHidden
      />
    </ServerDataTable>
  );
}

export function UserPublishedPostsTableFallback({ message }: UserPublishedPostsTableFallbackProps) {
  const minHeight = getReservedTableContentMinHeight(10);

  return (
    <Box
      style={{
        minHeight,
        position: 'relative',
      }}
    >
      <PageLoader minHeight={minHeight} message={message} />
    </Box>
  );
}
