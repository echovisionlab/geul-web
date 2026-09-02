'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Carousel } from '@mantine/carousel';
import { Group, Pagination, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { ContentCard, ContentCardSection } from '@/components/core/Section';
import { listPublishedPosts } from '@/lib/queries/post-browser';
import { getSlideSize } from '../constants';
import type { BlockViewProps } from '../types';
import { parsePostListProps } from './schema';
import { PostListViewClient } from './ViewClient';

export function PostListView({ props }: BlockViewProps) {
  const p = parsePostListProps(props);

  // Parse durable props stored as strings
  const categoryIds = p.categoryIds ? p.categoryIds.split(',').filter(Boolean) : undefined;
  const tagIds = p.tagIds ? p.tagIds.split(',').filter(Boolean) : undefined;
  const authorIds = p.authorIds ? p.authorIds.split(',').filter(Boolean) : undefined;
  const seriesId = p.seriesId || undefined;
  const sortBy = (p.sortBy as 'published_at' | 'updated_at' | 'title') || 'published_at';
  const sortOrder = (p.sortOrder as 'asc' | 'desc') || 'desc';
  const limit = parseInt(p.limit || '6', 10);
  const layout = p.layout || 'grid';
  const columns = parseInt(p.columns || '3', 10);
  const showPagination = p.showPagination === 'true';
  const carouselLoop = p.carouselLoop !== 'false';
  const carouselIndicators = p.carouselIndicators !== 'false';
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: [
      'posts',
      'published',
      { categoryIds, tagIds, authorIds, seriesId, sortBy, sortOrder, limit, page, showPagination },
    ],
    queryFn: () =>
      listPublishedPosts({
        categoryIds,
        tagIds,
        authorIds,
        seriesId,
        sortBy,
        sortOrder,
        limit: showPagination ? limit : limit,
        offset: showPagination ? (page - 1) * limit : 0,
      }),
  });

  if (isLoading) {
    const skeletonCards = Array.from({ length: limit }).map((_, i) => (
      <ContentCard key={i} padding={0} radius={0} withBorder={false} style={{ background: 'transparent' }}>
        <ContentCardSection style={{ aspectRatio: '16/9' }}>
          <Skeleton height="100%" />
        </ContentCardSection>
        <Stack gap={8} mt={8}>
          <Skeleton height={20} width="80%" />
          <Skeleton height={14} width="60%" />
        </Stack>
      </ContentCard>
    ));

    if (layout === 'carousel') {
      const slideSize = getSlideSize(columns);
      return (
        <Carousel
          slideSize={{ base: '100%', sm: columns === 1 ? '100%' : '50%', md: slideSize }}
          slideGap="md"
          emblaOptions={{ loop: carouselLoop }}
          withIndicators={carouselIndicators}
          className="post-list-block"
        >
          {skeletonCards.map((card, i) => (
            <Carousel.Slide key={i}>{card}</Carousel.Slide>
          ))}
        </Carousel>
      );
    }

    return (
      <SimpleGrid cols={{ base: 1, sm: 2, md: columns }} spacing="lg" className="post-list-block">
        {skeletonCards}
      </SimpleGrid>
    );
  }

  if (!data?.posts?.length) {
    return (
      <Text c="dimmed" ta="center" py="xl" className="post-list-block">
        No posts found
      </Text>
    );
  }

  const content = (
    <PostListViewClient
      posts={data.posts.map((post) => ({
        id: post.id,
        slug: post.slug ?? null,
        title: post.title,
        featured_image_url: post.featured_image_url ?? null,
        published_at: post.published_at?.toISOString() ?? null,
        authors: post.authors.map((author) => ({
          id: author.id,
          name: author.name,
          image: author.avatar_url ?? null,
        })),
        categories: post.categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug ?? null,
        })),
        tags: post.tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          slug: tag.slug ?? null,
        })),
      }))}
      parsedProps={p}
    />
  );

  return (
    <>
      {content}
      {showPagination && data.pagination.total > limit ? (
        <Group justify="center" mt="md">
          <Pagination total={Math.ceil(data.pagination.total / limit)} value={page} onChange={setPage} />
        </Group>
      ) : null}
    </>
  );
}
