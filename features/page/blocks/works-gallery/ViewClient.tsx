'use client';

import { useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
import { DateTime } from '@/features/date-time/DateTime';
import { EntityListView, type EntityListItem } from '../EntityListView';
import type { WorkListProps } from './schema';

interface WorkListItem extends EntityListItem {
  type: 'music_project' | 'portfolio' | 'article' | 'contribution';
  publishedAt: string | null;
}

interface WorkListViewClientProps {
  works: WorkListItem[];
  parsedProps: WorkListProps;
}

export function WorkListViewClient({ works, parsedProps: p }: WorkListViewClientProps) {
  const tWorks = useTranslations('works');
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
      emptyLabel="No works found"
      layout={layout}
      columns={columns}
      showImage={showImage}
      imageAspectRatio={imageAspectRatio}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
      renderMeta={
        showMeta
          ? (work) => (
              <Stack gap={2}>
                <Text size="xs" c="dimmed">
                  {workTypeLabels[work.type]}
                </Text>
                {work.publishedAt ? (
                  <Text size="xs" c="dimmed">
                    <DateTime value={work.publishedAt} />
                  </Text>
                ) : null}
              </Stack>
            )
          : undefined
      }
    />
  );
}
