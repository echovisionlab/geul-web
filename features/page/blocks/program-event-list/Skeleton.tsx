'use client';

import { ListBlockSkeleton } from '../ListBlockSkeleton';

interface ProgramEventListSkeletonProps {
  columns?: number;
  limit?: number;
  layout?: string;
  carouselLoop?: boolean;
  carouselIndicators?: boolean;
}

export function ProgramEventListSkeleton({
  columns = 3,
  limit = 6,
  layout = 'grid',
  carouselLoop = true,
  carouselIndicators = true,
}: ProgramEventListSkeletonProps) {
  return (
    <ListBlockSkeleton
      className="program-event-list-block"
      columns={columns}
      limit={limit}
      layout={layout}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
    />
  );
}
