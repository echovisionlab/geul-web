'use client';
import dynamic from 'next/dynamic';
import { LayoutInline, LayoutGrid, LayoutStack, LayoutInset } from '@/components/core/Layout';
import {
  Collection,
  CollectionMedia,
  getCollectionMetrics,
  type CollectionSize,
  type CollectionMediaProps,
} from '@/components/core/Collection';
import { Skeleton } from '@/components/core/Display';
import { SectionCard } from '@/components/core/Section';
import { COLLECTION_COLUMN_GROWTH, collectionMinColumnWidth, type CollectionTrackScale } from './content-layout';
import { getResponsiveSlideSize } from './constants';
const ListCarousel = dynamic(() => import('./ListCarouselRuntime').then((module) => module.ListCarouselRuntime));
interface ListBlockSkeletonProps {
  className: string;
  columns?: number;
  limit?: number;
  layout?: string;
  itemSize?: CollectionSize;
  showImage?: boolean;
  imageAspectRatio?: CollectionMediaProps['aspectRatio'];
  carouselLoop?: boolean;
  carouselIndicators?: boolean;
  trackScale?: CollectionTrackScale;
}
export function ListBlockSkeleton({
  className,
  columns = 3,
  limit = 6,
  layout = 'grid',
  itemSize = 'm',
  showImage = true,
  imageAspectRatio = '16:9',
  carouselLoop = true,
  carouselIndicators = true,
  trackScale = 'standard',
}: ListBlockSkeletonProps) {
  const metrics = getCollectionMetrics(itemSize);
  const horizontal = layout === 'list' || layout === 'cards' || (layout === 'carousel' && columns !== 1);
  const cards = Array.from({ length: limit }, (_, index) => {
    const text = (
      <LayoutStack flexible gap={metrics.itemGap}>
        <Skeleton roleType="text" width="medium" />
        <Skeleton roleType="text" width="short" />
      </LayoutStack>
    );
    const media =
      showImage && layout !== 'minimal' ? (
        <CollectionMedia
          width={horizontal ? 'thumbnail' : 'full'}
          aspectRatio={imageAspectRatio === 'auto' ? '16:9' : imageAspectRatio}
          hero={layout === 'carousel' && columns === 1}
        >
          <Skeleton roleType="fill" />
        </CollectionMedia>
      ) : null;
    return (
      <SectionCard appearance="plain" key={index} padding="none" withBorder={false}>
        {layout === 'minimal' ? (
          <LayoutInset block={metrics.rowInset}>{text}</LayoutInset>
        ) : horizontal ? (
          <LayoutInline wrap="nowrap" align="start" gap={metrics.rowGap}>
            {media}
            {text}
          </LayoutInline>
        ) : (
          <LayoutStack gap={metrics.itemGap}>
            {media}
            {text}
          </LayoutStack>
        )}
      </SectionCard>
    );
  });
  const body =
    layout === 'list' || layout === 'minimal' ? (
      <LayoutStack gap={layout === 'minimal' ? 'none' : metrics.rowGap}>{cards}</LayoutStack>
    ) : layout === 'carousel' ? (
      <ListCarousel
        slideSize={getResponsiveSlideSize(columns)}
        slideGap={metrics.rowGap}
        loop={carouselLoop}
        withIndicators={carouselIndicators}
      >
        {cards}
      </ListCarousel>
    ) : (
      <LayoutGrid
        minColumnWidth={collectionMinColumnWidth(layout, itemSize, trackScale)}
        columnGrowth={COLLECTION_COLUMN_GROWTH}
        gap={metrics.gridGap}
      >
        {cards}
      </LayoutGrid>
    );
  return (
    <div className={className} aria-busy="true">
      <Collection size={itemSize}>{body}</Collection>
    </div>
  );
}
