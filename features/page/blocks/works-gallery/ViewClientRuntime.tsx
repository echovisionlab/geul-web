'use client';
import { getCollectionMetrics } from '@/components/core/Collection/collection-contract';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useTranslations } from 'next-intl';

import { DateTime } from '@/features/date-time/DateTime';
import { EntityListView, type EntityListItem } from '../EntityListView';
import type { WorkListProps } from './schema';

interface WorkListItem extends EntityListItem {
  type: 'music_project' | 'portfolio' | 'article' | 'contribution';
  publishedAt: string | null;
}

export interface WorkListViewClientProps {
  works: WorkListItem[];
  parsedProps: WorkListProps;
}

export function WorkListViewClient({ works, parsedProps: p }: WorkListViewClientProps) {
  const tWorks = useTranslations('works');
  const tCommon = useTranslations('common');
  const metrics = getCollectionMetrics(p.itemSize);
  const layout = p.layout || 'grid';
  const columns = parseInt(p.columns || '3', 10);
  const showImage = p.showImage !== 'false';
  const showMeta = p.showMeta !== 'false';
  const imageAspectRatio = p.imageAspectRatio || '16:9';
  const carouselLoop = p.carouselLoop !== 'false';
  const carouselIndicators = p.carouselIndicators !== 'false';
  const workTypeLabels: Record<WorkListItem['type'], string> = {
    music_project: tWorks('types.music_project'),
    portfolio: tWorks('types.portfolio'),
    article: tWorks('types.article'),
    contribution: tWorks('types.contribution'),
  };

  return (
    <EntityListView
      items={works}
      className="work-list-block"
      emptyLabel={tCommon('messages.noWorksFound')}
      layout={layout}
      itemSize={p.itemSize}
      columns={columns}
      showImage={showImage}
      imageAspectRatio={imageAspectRatio}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
      renderMeta={
        showMeta
          ? (work) => (
              <DsLayoutStack gap="xxs">
                <DsText size={metrics.metaSize} tone="secondary">
                  {workTypeLabels[work.type]}
                </DsText>
                {work.publishedAt ? (
                  <DsText size={metrics.metaSize} tone="secondary">
                    <DateTime value={work.publishedAt} />
                  </DsText>
                ) : null}
              </DsLayoutStack>
            )
          : undefined
      }
    />
  );
}
