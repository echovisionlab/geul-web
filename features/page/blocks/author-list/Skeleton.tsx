import { contentColumns } from '@/features/page/blocks/content-layout';
import {
  LayoutGrid as DsLayoutGrid,
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
} from '@/components/core/Layout';
import { Skeleton } from '@/components/core/Display';
import { SectionCard } from '@/components/core/Section';
import { getCollectionMetrics, type CollectionSize } from '@/components/core/Collection/collection-contract';
interface AuthorListSkeletonProps {
  columns?: number;
  limit?: number;
  itemSize?: CollectionSize;
  layout?: string;
}
export function AuthorListSkeleton({ columns = 3, limit = 6, itemSize, layout = 'grid' }: AuthorListSkeletonProps) {
  const metrics = getCollectionMetrics(itemSize);
  return (
    <div className="author-list-block" data-collection-size={itemSize ?? 'm'} aria-busy="true">
      <DsLayoutGrid
        columns={layout === 'list' ? 1 : { base: 1, sm: 2, md: contentColumns(columns) }}
        gap={layout === 'list' ? 'none' : metrics.gridGap}
      >
        {Array.from({ length: limit }).map((_, i) => (
          <SectionCard
            key={i}
            padding={metrics.rowInset}
            appearance="plain"
            border={layout === 'list' ? 'block-end' : 'none'}
          >
            <DsLayoutInline gap={metrics.rowGap} wrap="nowrap">
              <Skeleton roleType="avatar" shape="circle" />
              <DsLayoutStack gap={metrics.itemGap} flexible>
                <Skeleton roleType="text" width="medium" />
                <Skeleton roleType="text" width="long" />
              </DsLayoutStack>
            </DsLayoutInline>
          </SectionCard>
        ))}
      </DsLayoutGrid>
    </div>
  );
}
