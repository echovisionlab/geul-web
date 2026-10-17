'use client';

import type { CollectionMediaProps, CollectionSize } from '@/components/core/Collection';

import { ListBlockSkeleton } from '../ListBlockSkeleton';

interface ReleaseListSkeletonProps {
  itemSize?: CollectionSize;
  showImage?: boolean;
  imageAspectRatio?: CollectionMediaProps['aspectRatio'];
  columns?: number;
  limit?: number;
  layout?: string;
  carouselLoop?: boolean;
  carouselIndicators?: boolean;
}

export function ReleaseListSkeleton({
  itemSize,
  showImage,
  imageAspectRatio,
  columns = 4,
  limit = 8,
  layout = 'grid',
  carouselLoop = true,
  carouselIndicators = true,
}: ReleaseListSkeletonProps) {
  return (
    <ListBlockSkeleton
      itemSize={itemSize}
      showImage={showImage}
      imageAspectRatio={imageAspectRatio}
      className="release-list-block"
      columns={columns}
      limit={limit}
      layout={layout}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
      trackScale="compact"
    />
  );
}
