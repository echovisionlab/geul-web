'use client';
import { useTranslations } from 'next-intl';
import type { ComponentProps } from 'react';
import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { ServerDataTable, type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { UserPublishedPostsTableContent } from './UserPublishedPostsTableContent';
interface Props {
  result: ComponentProps<typeof UserPublishedPostsTableContent>['result'];
  emptyMessage: string;
  searchPlaceholder: string;
  filterFields: FilterFieldConfig[];
  sortFields: SortFieldConfig[];
  searchParams: string;
  queryError?: string | null;
}
export function UserPublishedPostsTableView({
  result,
  emptyMessage,
  searchPlaceholder,
  filterFields,
  sortFields,
  searchParams,
  queryError,
}: Props) {
  const tProfile = useTranslations('userProfile');
  return (
    <ServerDataTable namespace="userPosts" accessibleLabel={tProfile('sections.publishedPosts')}>
      <ServerDataTable.Toolbar>
        <ServerDataTable.Search namespace="userPosts" placeholder={searchPlaceholder} />
        <DsLayoutInline gap="xxs">
          <ServerDataTable.MultiFilter namespace="userPosts" fields={filterFields} allowLogicToggle={false} />
          <ServerDataTable.MultiSort namespace="userPosts" fields={sortFields} />
        </DsLayoutInline>
      </ServerDataTable.Toolbar>
      {queryError ? (
        <DsText size="sm" tone="danger" role="alert">
          {queryError}
        </DsText>
      ) : (
        <UserPublishedPostsTableContent result={result} emptyMessage={emptyMessage} />
      )}
      <ServerDataTablePaginationClient
        namespace="userPosts"
        result={result}
        searchParams={new URLSearchParams(searchParams)}
        reserveSpaceWhenHidden
      />
    </ServerDataTable>
  );
}
