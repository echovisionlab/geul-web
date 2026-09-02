'use client';

import { Stack } from '@mantine/core';
import { SocialLinksDisplay } from '@/features/social-links/SocialLinksDisplay';
import { EntityListView, type EntityListItem } from '../EntityListView';
import type { ArtistListProps } from './schema';

interface ArtistListItem extends EntityListItem {
  socialLinks: Record<string, string> | null;
}

interface ArtistListViewClientProps {
  artists: ArtistListItem[];
  parsedProps: ArtistListProps;
}

export function ArtistListViewClient({ artists, parsedProps: p }: ArtistListViewClientProps) {
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
      emptyLabel="No artists found"
      layout={layout}
      columns={columns}
      showImage={showImage}
      imageAspectRatio={imageAspectRatio}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
      renderMeta={
        showMeta
          ? (artist) =>
              artist.socialLinks && Object.keys(artist.socialLinks).length > 0 ? (
                <Stack gap={2}>
                  <SocialLinksDisplay links={artist.socialLinks} gap="xs" />
                </Stack>
              ) : null
          : undefined
      }
    />
  );
}
