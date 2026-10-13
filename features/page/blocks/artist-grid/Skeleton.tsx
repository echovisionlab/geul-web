import type { CollectionMediaProps, CollectionSize } from '@/components/core/Collection';
import { ListBlockSkeleton } from '../ListBlockSkeleton';

interface ArtistListSkeletonProps {
  limit?: number;
  itemSize?: CollectionSize;
  showImage?: boolean;
  imageAspectRatio?: CollectionMediaProps['aspectRatio'];
  columns?: number;
  layout?: string;
  carouselLoop?: boolean;
  carouselIndicators?: boolean;
}

export function ArtistListSkeleton({
  limit = 6,
  itemSize,
  showImage,
  imageAspectRatio,
  columns = 3,
  layout = 'grid',
  carouselLoop = true,
  carouselIndicators = true,
}: ArtistListSkeletonProps) {
  return (
    <ListBlockSkeleton
      itemSize={itemSize}
      showImage={showImage}
      imageAspectRatio={imageAspectRatio}
      className="artist-list-block"
      columns={columns}
      limit={Math.min(limit, 12)}
      layout={layout}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
    />
  );
}
