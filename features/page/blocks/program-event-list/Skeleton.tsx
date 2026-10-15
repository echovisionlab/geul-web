'use client';

import type { CollectionMediaProps, CollectionSize } from '@/components/core/Collection';

import { ListBlockSkeleton } from '../ListBlockSkeleton';

interface ProgramEventListSkeletonProps {
  itemSize?: CollectionSize;
  showImage?: boolean;
  imageAspectRatio?: CollectionMediaProps['aspectRatio'];
  columns?: number;
  limit?: number;
  layout?: string;
  carouselLoop?: boolean;
  carouselIndicators?: boolean;
}

export function ProgramEventListSkeleton({
  itemSize,
  showImage,
  imageAspectRatio,
  columns = 3,
  limit = 6,
  layout = 'grid',
  carouselLoop = true,
  carouselIndicators = true,
}: ProgramEventListSkeletonProps) {
  return (
    <ListBlockSkeleton
      itemSize={itemSize}
      showImage={showImage}
      imageAspectRatio={imageAspectRatio}
      className="program-event-list-block"
      columns={columns}
      limit={limit}
      layout={layout}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
    />
  );
}
