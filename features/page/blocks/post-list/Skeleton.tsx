'use client';

import { Carousel } from '@mantine/carousel';
import { SimpleGrid, Skeleton, Stack } from '@mantine/core';
import { ContentCard, ContentCardSection } from '@/components/core/Section';
import { getSlideSize } from '../constants';

interface PostListSkeletonProps {
  columns?: number;
  limit?: number;
  layout?: string;
  carouselLoop?: boolean;
  carouselIndicators?: boolean;
}

export function PostListSkeleton({
  columns = 3,
  limit = 6,
  layout = 'grid',
  carouselLoop = true,
  carouselIndicators = true,
}: PostListSkeletonProps) {
  const skeletonCards = Array.from({ length: limit }).map((_, i) => (
    <ContentCard key={i} padding="lg" radius={0} withBorder>
      <ContentCardSection>
        <Skeleton height={180} />
      </ContentCardSection>
      <Stack gap="xs" mt="md">
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
