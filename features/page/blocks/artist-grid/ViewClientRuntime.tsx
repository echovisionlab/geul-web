'use client';

import { useTranslations } from 'next-intl';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import {
  SocialLinksDisplayView,
  type SocialLinkDisplayViewModel,
} from '@/features/social-links/ui/SocialLinksDisplayView';
import { EntityListView, type EntityListItem } from '../EntityListView';
import type { ArtistListProps } from './schema';

interface ArtistListItem extends EntityListItem {
  /** Prepared by the caller with `prepareSocialLinksDisplay`, so this runtime never loads the icon catalog. */
  socialLinkEntries: SocialLinkDisplayViewModel[];
}

export interface ArtistListViewClientProps {
  artists: ArtistListItem[];
  parsedProps: ArtistListProps;
}

export function ArtistListViewClient({ artists, parsedProps: p }: ArtistListViewClientProps) {
  const t = useTranslations();
  const layout = p.layout || 'grid';
  const columns = parseInt(p.columns || '3', 10);
  const showImage = p.showImage !== 'false';
  const showMeta = p.showMeta !== 'false';
  const imageAspectRatio = p.imageAspectRatio || '1:1';
  const carouselLoop = p.carouselLoop !== 'false';
  const carouselIndicators = p.carouselIndicators !== 'false';

  return (
    <EntityListView
      items={artists}
      className="artist-list-block"
      emptyLabel={t('common.messages.noArtistsFound')}
      layout={layout}
      itemSize={p.itemSize}
      columns={columns}
      showImage={showImage}
      imageAspectRatio={imageAspectRatio}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
      renderMeta={
        showMeta
          ? (artist) =>
              artist.socialLinkEntries.length > 0 ? (
                <DsLayoutStack gap="xxs">
                  <SocialLinksDisplayView entries={artist.socialLinkEntries} gap="xs" />
                </DsLayoutStack>
              ) : null
          : undefined
      }
    />
  );
}
