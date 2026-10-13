'use client';
import { SupportingText } from '@/components/core/Typography';
import { LayoutInset as DsLayoutInset } from '@/components/core/Layout';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { useQuery } from '@tanstack/react-query';
import { listAuthorsAction } from '@/lib/actions/user';
import type { BlockViewProps } from '../types';
import { parseAuthorIds, parseAuthorListProps } from './schema';
import { AuthorListViewClient } from './ViewClient';
import { AuthorListSkeleton } from './Skeleton';
export function AuthorListView({ props }: BlockViewProps) {
  const p = parseAuthorListProps(props);
  const columns = parseInt(p.columns || '3', 10);
  const limit = parseInt(p.limit || '6', 10);
  const selectedIds = parseAuthorIds(p.authorIds);
  const selected = p.source === 'selected';
  const loadedDataQuery = useQuery({
    queryKey: ['users', 'authors', selected ? 'selected' : 'automatic', selected ? selectedIds : limit],
    queryFn: () => listAuthorsAction(selected ? 24 : limit, selected ? selectedIds : []),
    enabled: !selected || selectedIds.length > 0,
  });
  const { data, isLoading } = loadedDataQuery;
  if (selected && selectedIds.length === 0) {
    return <AuthorListViewClient authors={[]} parsedProps={p} />;
  }
  if (loadedDataQuery.isError && loadedDataQuery.data === undefined) {
    return <QueryErrorAlert queries={[loadedDataQuery]} />;
  }
  if (isLoading) {
    return (
      <AuthorListSkeleton
        columns={columns}
        limit={selected ? selectedIds.length : limit}
        layout={p.layout}
        itemSize={p.itemSize}
      />
    );
  }
  if (!data?.length) {
    return (
      <div className="author-list-block">
        <DsLayoutInset block="xl">
          <SupportingText tone="secondary" align="center">
            No authors found
          </SupportingText>
        </DsLayoutInset>
      </div>
    );
  }
  return (
    <>
      <QueryErrorAlert queries={[loadedDataQuery]} />
      <AuthorListViewClient
        authors={data.map((author) => ({
          id: author.id,
          name: author.name,
          image: author.image,
          bio: author.bio,
          post_count: author.postCount,
        }))}
        parsedProps={p}
      />
    </>
  );
}
