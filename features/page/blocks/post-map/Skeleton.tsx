import { PageLoader } from '@/features/site/PageLoader';
export function PostMapSkeleton() {
  return (
    <div style={{ aspectRatio: '16 / 9', position: 'relative', minHeight: 200 }} aria-busy="true">
      <PageLoader height="100%" minHeight={0} />
    </div>
  );
}
