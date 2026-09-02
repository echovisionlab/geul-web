import { ListBlockSkeleton } from '../ListBlockSkeleton';

interface LabelListSkeletonProps {
  limit?: number;
  columns?: number;
  layout?: string;
  carouselLoop?: boolean;
  carouselIndicators?: boolean;
}

export function LabelListSkeleton({
  limit = 6,
  columns = 3,
  layout = 'grid',
  carouselLoop = true,
  carouselIndicators = true,
}: LabelListSkeletonProps) {
  return (
    <ListBlockSkeleton
      className="label-list-block"
      columns={columns}
      limit={Math.min(limit, 12)}
      layout={layout}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
    />
  );
}
