'use client';

import { ListBlockSkeleton } from '../ListBlockSkeleton';

interface WorkListSkeletonProps {
  columns?: number;
  limit?: number;
  layout?: string;
  carouselLoop?: boolean;
  carouselIndicators?: boolean;
}

export function WorkListSkeleton({
  columns = 3,
  limit = 6,
  layout = 'grid',
  carouselLoop = true,
  carouselIndicators = true,
}: WorkListSkeletonProps) {
  return (
    <ListBlockSkeleton
      className="work-list-block"
      columns={columns}
      limit={limit}
      layout={layout}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
    />
  );
}
