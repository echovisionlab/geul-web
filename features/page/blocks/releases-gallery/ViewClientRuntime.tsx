'use client';
import { useTranslations } from 'next-intl';
import { getCollectionMetrics } from '@/components/core/Collection/collection-contract';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';

import { DateTime } from '@/features/date-time/DateTime';
import { EntityListView, type EntityListItem } from '../EntityListView';
import { PostMetaLinks, type PostMetaLinkItem } from '../post-list/PostMetaLinks';
import type { ReleaseListProps } from './schema';

interface ReleaseListItem extends EntityListItem {
  releaseDate: string | null;
  mainArtists: PostMetaLinkItem[];
}

export interface ReleaseListViewClientProps {
  releases: ReleaseListItem[];
  parsedProps: ReleaseListProps;
}

export function ReleaseListViewClient({ releases, parsedProps: p }: ReleaseListViewClientProps) {
  const t = useTranslations();
  const releaseDateFallbackLabel = t('common.states.toBeAnnounced');
  const releaseArtistFallbackLabel = t('common.states.unknown');
  const metrics = getCollectionMetrics(p.itemSize);
  const layout = p.layout || 'grid';
  const columns = parseInt(p.columns || '4', 10);
  const showImage = p.showImage !== 'false';
  const showMeta = p.showMeta !== 'false';
  const imageAspectRatio = p.imageAspectRatio || '1:1';
  const carouselLoop = p.carouselLoop !== 'false';
  const carouselIndicators = p.carouselIndicators !== 'false';

  return (
    <EntityListView
      items={releases}
      className="release-list-block"
      emptyLabel={t('common.messages.noReleasesFound')}
      layout={layout}
      itemSize={p.itemSize}
      columns={columns}
      showImage={showImage}
      imageAspectRatio={imageAspectRatio}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
      gridCols={{ base: 2, sm: 3 }}
      renderMeta={
        showMeta
          ? (release) => (
              <DsLayoutStack gap="xxs">
                {release.mainArtists.length > 0 ? (
                  <PostMetaLinks
                    items={release.mainArtists}
                    textSize={metrics.metaSize}
                    tone="secondary"
                    separatorTone="secondary"
                  />
                ) : (
                  <DsText size={metrics.metaSize} tone="secondary">
                    {releaseArtistFallbackLabel}
                  </DsText>
                )}
                {release.releaseDate ? (
                  <DsText size={metrics.metaSize} tone="secondary">
                    <DateTime value={release.releaseDate} timeZone="UTC" />
                  </DsText>
                ) : (
                  <DsText size={metrics.metaSize} tone="secondary">
                    {releaseDateFallbackLabel}
                  </DsText>
                )}
              </DsLayoutStack>
            )
          : undefined
      }
    />
  );
}
