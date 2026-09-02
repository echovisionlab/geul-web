import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { Group, Text } from '@mantine/core';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { InvalidPublicTableQueryError } from '@/lib/queries/public-table';
import { listPublishedWorksTable } from '@/lib/queries/work';
import type { WorkType } from '@/lib/types/work/model';
import { MobileBlockTablePaginationScroll } from '../MobileBlockTablePaginationScroll';
import {
  buildBlockTableAnchorId,
  buildBlockTableNamespace,
  parseBlockTableQuery,
  queryRecordToSearchParams,
} from '../table-utils';
import { TableLoadingFallback } from '../TableLoadingFallback';
import type { BlockViewProps } from '../types';
import { parseWorkTableProps } from './schema';
import { WorkTableServerContent } from './ServerContent';
import {
  buildWorkTableFilterFields,
  buildWorkTableSortFields,
  parseWorkTableFilterFields,
  parseWorkTableSortFields,
} from './spec';

async function WorkTableViewServer({ sectionId, props, query, requestedLocale }: BlockViewProps) {
  const tCommon = requestedLocale
    ? await getTranslations({ locale: requestedLocale, namespace: 'common' })
    : await getTranslations('common');
  const tCommonPlaceholders = requestedLocale
    ? await getTranslations({ locale: requestedLocale, namespace: 'common.placeholders' })
    : await getTranslations('common.placeholders');
  const tPublicTables = requestedLocale
    ? await getTranslations({ locale: requestedLocale, namespace: 'publicTables' })
    : await getTranslations('publicTables');
  const tWorks = requestedLocale
    ? await getTranslations({ locale: requestedLocale, namespace: 'works' })
    : await getTranslations('works');
  const parsed = parseWorkTableProps(props);
  const pageSize = parseInt(parsed.pageSize || '10', 10);
  const namespace = buildBlockTableNamespace('workTable', sectionId);
  const anchorId = buildBlockTableAnchorId(namespace);
  const searchParams = queryRecordToSearchParams(query);
  const tableQuery = parseBlockTableQuery(searchParams, namespace, pageSize);
  const types = parsed.workTypes ? (parsed.workTypes.split(',').filter(Boolean) as WorkType[]) : undefined;
  const featuredOnly = parsed.featuredOnly === 'true';
  const statuses = parsed.statuses ? parsed.statuses.split(',').filter(Boolean) : ['WORK_STATUS_PUBLISHED'];
  const enabledFilterFields = parseWorkTableFilterFields(parsed.filterFields);
  const enabledSortFields = parseWorkTableSortFields(parsed.sortFields);

  const labelOverrides = {
    fieldLabels: {
      type: tCommon('labels.type'),
      status: tCommon('labels.status'),
      published_at: tCommon('labels.published'),
      updated_at: tCommon('labels.updated'),
      title: tCommon('labels.title'),
    },
    statusOptionLabels: {
      published: tCommon('statuses.published'),
      archived: tCommon('statuses.archived'),
    },
    typeOptionLabels: {
      music_project: tWorks('types.music_project'),
      portfolio: tWorks('types.portfolio'),
      article: tWorks('types.article'),
      contribution: tWorks('types.contribution'),
    },
  } as const;

  const filterFields = buildWorkTableFilterFields(enabledFilterFields, labelOverrides);
  const sortFields = buildWorkTableSortFields(enabledSortFields, labelOverrides);

  let result: Awaited<ReturnType<typeof listPublishedWorksTable>>;
  let queryError: string | null = null;
  try {
    result = await listPublishedWorksTable({
      query: tableQuery,
      pageSize,
      types,
      featuredOnly,
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
          <ServerDataTable.Search namespace={namespace} placeholder={tCommonPlaceholders('searchWorks')} />
          <Group gap={4}>
            <ServerDataTable.MultiFilter namespace={namespace} fields={filterFields} allowLogicToggle={false} />
            <ServerDataTable.MultiSort namespace={namespace} fields={sortFields} />
          </Group>
        </ServerDataTable.Toolbar>
        {queryError ? (
          <Text c="red">{queryError}</Text>
        ) : (
          <WorkTableServerContent
            result={result}
            labels={{
              title: tCommon('labels.title'),
              type: tCommon('labels.type'),
              period: tPublicTables('workColumns.period'),
              published: tCommon('labels.published'),
              present: tPublicTables('workColumns.present'),
            }}
            emptyMessage={tCommon('messages.noWorksFound')}
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

export async function WorkTableViewStreaming(props: BlockViewProps) {
  const parsed = parseWorkTableProps(props.props);
  const pageSize = parseInt(parsed.pageSize || '10', 10);
  const tCommonStates = props.requestedLocale
    ? await getTranslations({ locale: props.requestedLocale, namespace: 'common.states' })
    : await getTranslations('common.states');

  return (
    <Suspense fallback={<TableLoadingFallback reservedRowCount={pageSize} message={tCommonStates('loading')} />}>
      <WorkTableViewServer {...props} />
    </Suspense>
  );
}
