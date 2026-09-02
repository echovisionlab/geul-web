'use client';

import { Stack, Text } from '@mantine/core';
import { DateTime } from '@/features/date-time/DateTime';
import { EntityListView, type EntityListItem } from '../EntityListView';
import { PostMetaLinks, type PostMetaLinkItem } from '../post-list/PostMetaLinks';
import type { ReleaseListProps } from './schema';

const releaseDateFallbackLabel = 'TBA';
const releaseArtistFallbackLabel = 'Unknown';

interface ReleaseListItem extends EntityListItem {
  releaseDate: string | null;
  mainArtists: PostMetaLinkItem[];
}

interface ReleaseListViewClientProps {
  releases: ReleaseListItem[];
  parsedProps: ReleaseListProps;
}

export function ReleaseListViewClient({ releases, parsedProps: p }: ReleaseListViewClientProps) {
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
      emptyLabel="No releases found"
      layout={layout}
      columns={columns}
      showImage={showImage}
      imageAspectRatio={imageAspectRatio}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
      emptyImageLabel="No artwork"
      gridCols={{ base: 2, sm: 3 }}
      renderMeta={
        showMeta
          ? (release) => (
              <Stack gap={2}>
                {release.mainArtists.length > 0 ? (
                  <PostMetaLinks
                    items={release.mainArtists}
                    textSize="xs"
                    textColor="var(--mantine-color-dimmed)"
                    separatorColor="var(--mantine-color-dimmed)"
                  />
                ) : (
                  <Text size="xs" c="dimmed">
                    {releaseArtistFallbackLabel}
                  </Text>
                )}
                {release.releaseDate ? (
                  <Text size="xs" c="dimmed">
                    <DateTime value={release.releaseDate} timeZone="UTC" />
                  </Text>
                ) : (
                  <Text size="xs" c="dimmed">
                    {releaseDateFallbackLabel}
                  </Text>
                )}
              </Stack>
            )
          : undefined
      }
    />
  );
}
