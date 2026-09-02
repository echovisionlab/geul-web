'use client';

import { Carousel } from '@mantine/carousel';
import { Box, SimpleGrid, Skeleton, Stack } from '@mantine/core';
import { ContentCard } from '@/components/core/Section';
import { getSlideSize } from './constants';

interface ListBlockSkeletonProps {
  className: string;
  columns?: number;
  limit?: number;
  layout?: string;
  carouselLoop?: boolean;
  carouselIndicators?: boolean;
  gridCols?: {
    base: number;
    sm: number;
  };
}

function GridSkeletonCard() {
  return (
    <Stack gap="sm">
      <Skeleton h={180} />
      <Skeleton h={16} w="60%" />
      <Skeleton h={12} w="45%" />
    </Stack>
  );
}

export function ListBlockSkeleton({
  className,
  columns = 3,
  limit = 6,
  layout = 'grid',
  carouselLoop = true,
  carouselIndicators = true,
  gridCols = { base: 1, sm: 2 },
}: ListBlockSkeletonProps) {
  if (layout === 'minimal') {
    return (
      <Stack gap={0} className={className}>
        {Array.from({ length: limit }).map((_, index) => (
          <Stack key={index} gap={6} py="xs">
            <Skeleton h={16} w="55%" />
            <Skeleton h={12} w="35%" />
          </Stack>
        ))}
      </Stack>
    );
  }

  if (layout === 'list') {
    return (
      <Stack gap="md" className={className}>
        {Array.from({ length: limit }).map((_, index) => (
          <Box
            key={index}
            style={{
              display: 'grid',
              gridTemplateColumns: '96px minmax(0, 1fr)',
              gap: '0.875rem',
            }}
          >
            <Skeleton h={64} />
            <Stack gap={6}>
              <Skeleton h={16} w="60%" />
              <Skeleton h={12} w="45%" />
            </Stack>
          </Box>
        ))}
      </Stack>
    );
  }

  if (layout === 'cards') {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, md: columns }} spacing="lg" className={className}>
        {Array.from({ length: limit }).map((_, index) => (
          <Box
            key={index}
            style={{
              display: 'grid',
              gridTemplateColumns: '112px minmax(0, 1fr)',
              gap: '1rem',
            }}
          >
            <Skeleton h={84} />
            <Stack gap={6}>
              <Skeleton h={16} w="65%" />
              <Skeleton h={12} w="50%" />
            </Stack>
          </Box>
        ))}
      </SimpleGrid>
    );
  }

  const cards = Array.from({ length: limit }).map((_, index) => (
    <ContentCard key={index} padding={0} radius={0} withBorder={false} style={{ background: 'transparent' }}>
      <GridSkeletonCard />
    </ContentCard>
  ));

  if (layout === 'carousel') {
    const slideSize = getSlideSize(columns);
    return (
      <Carousel
        slideSize={{ base: '100%', sm: columns === 1 ? '100%' : '50%', md: slideSize }}
        slideGap="lg"
        emblaOptions={{ loop: carouselLoop }}
        withIndicators={carouselIndicators}
        className={className}
      >
        {cards.map((card, index) => (
          <Carousel.Slide key={index}>{card}</Carousel.Slide>
        ))}
      </Carousel>
    );
  }

  return (
    <SimpleGrid cols={{ base: gridCols.base, sm: gridCols.sm, md: columns }} spacing="lg" className={className}>
      {cards}
    </SimpleGrid>
  );
}
