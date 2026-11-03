import type { CollectionSize } from '@/components/core/Collection';
import { ListBlockSkeleton } from '../ListBlockSkeleton';
interface AuthorListSkeletonProps {
  limit?: number;
  itemSize?: CollectionSize;
  layout?: string;
}
export function AuthorListSkeleton(props: AuthorListSkeletonProps) {
  return <ListBlockSkeleton {...props} className="author-list-block" showImage={false} />;
}
