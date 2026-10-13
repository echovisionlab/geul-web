import type { CollectionMediaProps, CollectionSize } from '@/components/core/Collection';
import { ListBlockSkeleton } from '../ListBlockSkeleton';

interface LabelListSkeletonProps {
  limit?: number;
  itemSize?: CollectionSize;
  showImage?: boolean;
  imageAspectRatio?: CollectionMediaProps['aspectRatio'];
  columns?: number;
  layout?: string;
  carouselLoop?: boolean;
  carouselIndicators?: boolean;
}

export function LabelListSkeleton({
  limit = 6,
  itemSize,
  showImage,
  imageAspectRatio,
  columns = 3,
  layout = 'grid',
  carouselLoop = true,
  carouselIndicators = true,
}: LabelListSkeletonProps) {
  return (
    <ListBlockSkeleton
      itemSize={itemSize}
      showImage={showImage}
      imageAspectRatio={imageAspectRatio}
      className="label-list-block"
      columns={columns}
      limit={Math.min(limit, 12)}
      layout={layout}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
    />
  );
}
