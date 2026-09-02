'use client';

import { useQuery } from '@tanstack/react-query';
import { SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { listAuthorsAction } from '@/lib/actions/user';
import type { BlockViewProps } from '../types';
import { parseAuthorIds, parseAuthorListProps } from './schema';
import { AuthorListViewClient } from './ViewClient';

export function AuthorListView({ props }: BlockViewProps) {
  const p = parseAuthorListProps(props);

  const columns = parseInt(p.columns || '3', 10);
  const limit = parseInt(p.limit || '6', 10);
  const selectedIds = parseAuthorIds(p.authorIds);
  const selected = p.source === 'selected';

  const { data, isLoading } = useQuery({
    queryKey: ['users', 'authors', selected ? 'selected' : 'automatic', selected ? selectedIds : limit],
    queryFn: () => listAuthorsAction(selected ? 24 : limit, selected ? selectedIds : []),
    enabled: !selected || selectedIds.length > 0,
  });

  if (selected && selectedIds.length === 0) {
    return <AuthorListViewClient authors={[]} parsedProps={p} />;
  }

  if (isLoading) {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, md: columns }} spacing="lg" className="author-list-block">
        {Array.from({ length: selected ? selectedIds.length : limit }).map((_, i) => (
          <Stack key={i} gap="sm">
            <Skeleton circle height={60} width={60} />
            <Skeleton height={16} width="60%" />
            <Skeleton height={12} width="80%" />
          </Stack>
        ))}
      </SimpleGrid>
    );
  }

  if (!data?.length) {
    return (
      <Text c="dimmed" ta="center" py="xl" className="author-list-block">
        No authors found
      </Text>
    );
  }

  return (
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
  );
}
