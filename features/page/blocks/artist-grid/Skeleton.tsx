import { ListBlockSkeleton } from '../ListBlockSkeleton';

interface ArtistListSkeletonProps {
  limit?: number;
  columns?: number;
  layout?: string;
  carouselLoop?: boolean;
  carouselIndicators?: boolean;
}

export function ArtistListSkeleton({
  limit = 6,
  columns = 3,
  layout = 'grid',
  carouselLoop = true,
  carouselIndicators = true,
}: ArtistListSkeletonProps) {
  return (
    <ListBlockSkeleton
      className="artist-list-block"
      columns={columns}
      limit={Math.min(limit, 12)}
      layout={layout}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
    />
  );
}
