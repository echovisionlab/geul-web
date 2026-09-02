import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { Group, Text } from '@mantine/core';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { listPublishedPostsTable } from '@/lib/queries/post';
import { InvalidPublicTableQueryError } from '@/lib/queries/public-table';
import { listPublicSeriesOptions } from '@/lib/queries/series';
import { listPublicCategories, listPublicTags } from '@/lib/queries/taxonomy';
import { listAuthorOptions } from '@/lib/queries/user';
import { MobileBlockTablePaginationScroll } from '../MobileBlockTablePaginationScroll';
import {
  buildBlockTableAnchorId,
  buildBlockTableNamespace,
  parseBlockTableQuery,
  queryRecordToSearchParams,
} from '../table-utils';
import { TableLoadingFallback } from '../TableLoadingFallback';
import type { BlockViewProps } from '../types';
import { parsePostTableProps } from './schema';
import { PostTableServerContent } from './ServerContent';
import {
  buildPostTableFilterFields,
  buildPostTableSortFields,
  parsePostTableFilterFields,
  parsePostTableSortFields,
} from './spec';

async function PostTableViewServer({ sectionId, props, query, requestedLocale }: BlockViewProps) {
  const tCommon = requestedLocale
    ? await getTranslations({ locale: requestedLocale, namespace: 'common' })
    : await getTranslations('common');
  const tCommonPlaceholders = requestedLocale
    ? await getTranslations({ locale: requestedLocale, namespace: 'common.placeholders' })
    : await getTranslations('common.placeholders');
  const parsed = parsePostTableProps(props);
  const pageSize = parseInt(parsed.pageSize || '10', 10);
  const namespace = buildBlockTableNamespace('postTable', sectionId);
  const anchorId = buildBlockTableAnchorId(namespace);
  const searchParams = queryRecordToSearchParams(query);
  const tableQuery = parseBlockTableQuery(searchParams, namespace, pageSize);

  const categoryIds = parsed.categoryIds ? parsed.categoryIds.split(',').filter(Boolean) : undefined;
  const tagIds = parsed.tagIds ? parsed.tagIds.split(',').filter(Boolean) : undefined;
  const authorIds = parsed.authorIds ? parsed.authorIds.split(',').filter(Boolean) : undefined;
  const seriesId = parsed.seriesId || undefined;
  const statuses = parsed.statuses
    ? parsed.statuses.split(',').filter(Boolean)
    : ['POST_STATUS_PUBLISHED', 'POST_STATUS_ARCHIVED'];
  const enabledFilterFields = parsePostTableFilterFields(parsed.filterFields);
  const enabledSortFields = parsePostTableSortFields(parsed.sortFields);

  const [categories, tags, authors, series] = await Promise.all([
    listPublicCategories(),
    listPublicTags(),
    listAuthorOptions(50),
    listPublicSeriesOptions(),
  ]);

  const filterFields = buildPostTableFilterFields(enabledFilterFields, {
    categories: categories.map((category) => ({ value: category.id, label: category.name })),
    tags: tags.map((tag) => ({ value: tag.id, label: tag.name })),
    authors: authors.map((author) => ({
      value: author.id,
      label: author.name ?? tCommon('states.unknown'),
    })),
    series: series.map((item) => ({ value: item.id, label: item.title })),
  });

  const sortFields = buildPostTableSortFields(enabledSortFields);

  let result: Awaited<ReturnType<typeof listPublishedPostsTable>>;
  let queryError: string | null = null;
  try {
    result = await listPublishedPostsTable({
      query: tableQuery,
      pageSize,
      categoryIds,
      tagIds,
      authorIds,
      seriesId,
      statuses,
      allowedFilterFields: filterFields,
      allowedSortFields: sortFields,
      rejectInvalidQuery: true,
      requestedLocale,
    });
  } catch (error) {
    if (!(error instanceof InvalidPublicTableQueryError)) {
      throw error;
    }
    queryError = error.message;
    result = {
      data: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 0,
    };
  }

  return (
    <div id={anchorId} style={{ scrollMarginTop: 'var(--scroll-offset, 80px)' }}>
      <MobileBlockTablePaginationScroll namespace={namespace} targetId={anchorId} />
      <ServerDataTable namespace={namespace}>
        <ServerDataTable.Toolbar>
          <ServerDataTable.Search namespace={namespace} placeholder={tCommonPlaceholders('searchPosts')} />
          <Group gap={4}>
            <ServerDataTable.MultiFilter namespace={namespace} fields={filterFields} allowLogicToggle={false} />
            <ServerDataTable.MultiSort namespace={namespace} fields={sortFields} />
          </Group>
        </ServerDataTable.Toolbar>
        {queryError ? (
          <Text c="red">{queryError}</Text>
        ) : (
          <PostTableServerContent
            result={result}
            labels={{
              title: tCommon('labels.title'),
              authors: tCommon('labels.authors'),
              categories: tCommon('entities.categories'),
              published: tCommon('labels.published'),
              untitled: tCommon('states.untitled'),
              unknown: tCommon('states.unknown'),
            }}
            emptyMessage={tCommon('messages.noPostsFound')}
          />
        )}
        <ServerDataTable.Pagination
          namespace={namespace}
          result={result}
          searchParams={searchParams}
          reserveSpaceWhenHidden
        />
      </ServerDataTable>
    </div>
  );
}

export async function PostTableViewStreaming(props: BlockViewProps) {
  const parsed = parsePostTableProps(props.props);
  const pageSize = parseInt(parsed.pageSize || '10', 10);
  const tCommonStates = props.requestedLocale
    ? await getTranslations({ locale: props.requestedLocale, namespace: 'common.states' })
    : await getTranslations('common.states');

  return (
    <Suspense fallback={<TableLoadingFallback reservedRowCount={pageSize} message={tCommonStates('loading')} />}>
      <PostTableViewServer {...props} />
    </Suspense>
  );
}
