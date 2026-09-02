'use client';

import { ListBlockSkeleton } from '../ListBlockSkeleton';

interface ReleaseListSkeletonProps {
  columns?: number;
  limit?: number;
  layout?: string;
  carouselLoop?: boolean;
  carouselIndicators?: boolean;
}

export function ReleaseListSkeleton({
  columns = 4,
  limit = 8,
  layout = 'grid',
  carouselLoop = true,
  carouselIndicators = true,
}: ReleaseListSkeletonProps) {
  return (
    <ListBlockSkeleton
      className="release-list-block"
      columns={columns}
      limit={limit}
      layout={layout}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
      gridCols={{ base: 2, sm: 3 }}
    />
  );
}
