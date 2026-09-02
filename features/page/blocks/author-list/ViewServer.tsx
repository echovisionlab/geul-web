import { Suspense } from 'react';
import { listAuthors } from '@/lib/queries/user';
import type { BlockViewProps } from '../types';
import { parseAuthorIds, parseAuthorListProps } from './schema';
import { AuthorListSkeleton } from './Skeleton';
import { AuthorListViewClient } from './ViewClient';

async function AuthorListViewServer({ props }: BlockViewProps) {
  const p = parseAuthorListProps(props);
  const limit = parseInt(p.limit || '6', 10);
  const selectedIds = parseAuthorIds(p.authorIds);

  const authors =
    p.source === 'selected' && selectedIds.length === 0
      ? []
      : await listAuthors(p.source === 'selected' ? 24 : limit, p.source === 'selected' ? selectedIds : []);

  // Transform to the format expected by ViewClient (snake_case for consistency)
  const transformedAuthors = authors.map((a) => ({
    id: a.id,
    name: a.name,
    image: a.image,
    bio: a.bio ?? null,
    post_count: a.postCount,
  }));

  return <AuthorListViewClient authors={transformedAuthors} parsedProps={p} />;
}

export function AuthorListViewStreaming({ props }: BlockViewProps) {
  const p = parseAuthorListProps(props);
  const columns = parseInt(p.columns || '3', 10);
  const limit = parseInt(p.limit || '6', 10);
  const selectedIds = parseAuthorIds(p.authorIds);

  return (
    <Suspense
      fallback={<AuthorListSkeleton columns={columns} limit={p.source === 'selected' ? selectedIds.length : limit} />}
    >
      <AuthorListViewServer props={props} />
    </Suspense>
  );
}
