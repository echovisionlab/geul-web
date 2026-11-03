import { LayoutGrid, LayoutInset as DsLayoutInset, LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import { Skeleton } from '@/components/core/Display';
import { SectionCard } from '@/components/core/Section';

export function PostMapSkeleton() {
  return (
    <DsLayoutStack gap="md">
      <div style={{ aspectRatio: '16 / 9', overflow: 'hidden' }}>
        <DsLayoutInset space="none">
          <Skeleton roleType="fill" />
        </DsLayoutInset>
      </div>

      <SectionCard withBorder padding="lg">
        <DsLayoutStack gap="sm">
          <Skeleton roleType="heading" width="short" />
          <Skeleton roleType="text" width="medium" />
          <LayoutGrid columns={{ base: 1, sm: 2 }} gap="md">
            <Skeleton roleType="media" />
            <Skeleton roleType="media" />
          </LayoutGrid>
        </DsLayoutStack>
      </SectionCard>
    </DsLayoutStack>
  );
}
