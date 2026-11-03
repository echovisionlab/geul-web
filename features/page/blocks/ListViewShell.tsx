'use client';
import { breakpointQuery } from '@/components/core/Layout/breakpoints';
import { SupportingText, ImageChrome, Text, Heading } from '@/components/core/Typography';

import { Fragment, useId, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { PageLoader } from '@/features/site/PageLoader';
import NextImage from 'next/image';
import { useTranslations } from 'next-intl';
import { useMediaQuery } from '@mantine/hooks';
import Link from '@/components/core/Navigation';

import { LayoutGrid, LayoutInline, LayoutStack, LayoutInset } from '@/components/core/Layout';
import {
  Collection,
  CollectionMedia,
  getCollectionMetrics,
  type CollectionSize,
  type CollectionMediaProps,
} from '@/components/core/Collection';
import { Button } from '@/components/core/Button';
import { SectionCard } from '@/components/core/Section';
import { COLLECTION_COLUMN_GROWTH, collectionMinColumnWidth, type CollectionTrackScale } from './content-layout';
import { getResponsiveSlideSize } from './constants';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';

// The widest Core Collection thumbnail (XL, the 28rem grid track); smaller sizes reuse the same file.
const THUMBNAIL_IMAGE_SIZES = '28rem';
// A hero carousel title grows with the item size from `sm` (phones keep scale 3).
const HERO_TITLE_SCALE = { xs: 3, s: 3, m: 2, l: 1, xl: 1 } as const satisfies Record<CollectionSize, 1 | 2 | 3>;
const ListCarousel = dynamic(() => import('./ListCarouselRuntime').then((module) => module.ListCarouselRuntime), {
  loading: () => <PageLoader placement="flow" />,
});

export type ListViewLayout = 'grid' | 'list' | 'cards' | 'minimal' | 'carousel';
export interface ListViewShellItem {
  id: string;
  href: string;
  title: string | null;
  imageUrl: string | null;
  imageAlt?: string | null;
}
interface ListViewShellProps<T extends ListViewShellItem> {
  items: T[];
  className: string;
  emptyLabel: string;
  layout: ListViewLayout;
  itemSize?: CollectionSize;
  columns: number;
  showImage: boolean;
  imageAspectRatio?: string;
  carouselLoop: boolean;
  carouselIndicators: boolean;
  /** `compact` for square artwork collections (one size step denser). */
  trackScale?: CollectionTrackScale;
  dataScope?: 'post-list';
  renderListMeta?: (item: T) => ReactNode;
  renderMinimalMeta?: (item: T) => ReactNode;
  renderCardsMeta?: (item: T) => ReactNode;
  renderGridMeta?: (item: T) => ReactNode;
  renderCarouselCardMeta?: (item: T) => ReactNode;
  renderHeroMeta?: (item: T, options: { mobile: boolean }) => ReactNode;
}

function hasNode(node: ReactNode) {
  return node !== null && node !== undefined && node !== false;
}
function hasSvgImage(item: ListViewShellItem) {
  const pathname = item.imageUrl?.split(/[?#]/)[0].toLowerCase();
  return Boolean(pathname?.endsWith('.svg') || pathname?.startsWith('data:image/svg+xml'));
}
function mediaImageFitStyle(item: ListViewShellItem) {
  return { objectFit: hasSvgImage(item) ? 'contain' : 'cover', objectPosition: 'center' } as const;
}
function MediaImage({
  item,
  naturalSize = false,
  sizes = `${breakpointQuery('sm')} 100vw, ${breakpointQuery('lg')} 50vw, 33vw`,
}: {
  item: ListViewShellItem;
  naturalSize?: boolean;
  sizes?: string;
}) {
  if (!item.imageUrl) {
    return null;
  }
  if (naturalSize) {
    return (
      <img
        src={buildManagedImageUrl(item.imageUrl, MANAGED_IMAGE_PRESET.CONTENT_IMAGE) ?? item.imageUrl}
        alt={item.imageAlt ?? item.title ?? ''}
        loading="lazy"
        style={{ display: 'block', width: '100%', height: 'auto', ...mediaImageFitStyle(item) }}
      />
    );
  }
  return (
    <NextImage
      src={item.imageUrl}
      alt={item.imageAlt ?? item.title ?? ''}
      fill
      sizes={sizes}
      unoptimized={hasSvgImage(item)}
      style={mediaImageFitStyle(item)}
    />
  );
}
function ItemMedia({
  item,
  ratio,
  thumbnail = false,
  ...props
}: {
  item: ListViewShellItem;
  ratio: NonNullable<CollectionMediaProps['aspectRatio']>;
  thumbnail?: boolean;
} & Partial<
  Pick<
    CollectionMediaProps,
    'data-post-list-list-media' | 'data-post-list-card-media' | 'data-post-list-carousel-card-media'
  >
>) {
  const tStates = useTranslations('common.states');
  const naturalSize = ratio === 'auto' && Boolean(item.imageUrl);
  return (
    <CollectionMedia
      {...props}
      width={thumbnail ? 'thumbnail' : 'full'}
      aspectRatio={ratio === 'auto' && !item.imageUrl ? '16:9' : ratio}
      backdrop={hasSvgImage(item) ? 'transparent' : 'muted'}
    >
      <Link
        href={item.href}
        appearance="media"
        mediaPosition={naturalSize ? 'flow' : 'fill'}
        aria-label={item.title?.trim() || tStates('untitled')}
        tabIndex={-1}
      >
        <MediaImage item={item} naturalSize={naturalSize} sizes={thumbnail ? THUMBNAIL_IMAGE_SIZES : undefined} />
      </Link>
    </CollectionMedia>
  );
}

export function ListViewShell<T extends ListViewShellItem>({
  items,
  className,
  emptyLabel,
  layout,
  itemSize = 'm',
  columns,
  showImage,
  imageAspectRatio = '16:9',
  carouselLoop,
  carouselIndicators,
  trackScale = 'standard',
  dataScope,
  renderListMeta,
  renderMinimalMeta,
  renderCardsMeta,
  renderGridMeta,
  renderCarouselCardMeta,
  renderHeroMeta,
}: ListViewShellProps<T>) {
  const titleIdPrefix = useId();
  const tActions = useTranslations('common.actions');
  const tStates = useTranslations('common.states');
  const isMobile = useMediaQuery(breakpointQuery('sm'));
  const metrics = getCollectionMetrics(itemSize);
  const ratio: NonNullable<CollectionMediaProps['aspectRatio']> =
    imageAspectRatio === 'auto' || imageAspectRatio === '1:1' || imageAspectRatio === '4:3' ? imageAspectRatio : '16:9';
  const scoped = dataScope === 'post-list';
  const title = (item: T) => (
    <Link
      href={item.href}
      appearance="quiet"
      data-list-title-link
      aria-label={item.title?.trim() ? undefined : tStates('untitled')}
    >
      <Text weight="medium" size={metrics.titleSize} lines={2}>
        {item.title ?? ''}
      </Text>
    </Link>
  );
  const content = (item: T, meta: ReactNode, kind: 'list' | 'minimal' | 'card' | 'grid' | 'carousel-card') => (
    <LayoutStack
      flexible
      gap={metrics.itemGap}
      data-post-list-list-content={scoped && kind === 'list' ? '' : undefined}
      data-post-list-minimal-content={scoped && kind === 'minimal' ? '' : undefined}
      data-post-list-card-content={scoped && kind === 'card' ? '' : undefined}
      data-post-list-grid-content={scoped && kind === 'grid' ? '' : undefined}
      data-post-list-carousel-card-content={scoped && kind === 'carousel-card' ? '' : undefined}
    >
      {title(item)}
      {hasNode(meta) ? (
        <LayoutStack
          gap="xxs"
          data-post-list-list-meta={scoped && kind === 'list' ? '' : undefined}
          data-post-list-minimal-meta={scoped && kind === 'minimal' ? '' : undefined}
          data-post-list-card-meta={scoped && kind === 'card' ? '' : undefined}
          data-post-list-grid-meta={scoped && kind === 'grid' ? '' : undefined}
          data-post-list-carousel-card-meta={scoped && kind === 'carousel-card' ? '' : undefined}
        >
          {meta}
        </LayoutStack>
      ) : null}
    </LayoutStack>
  );
  const card = (item: T, meta: ReactNode, kind: 'list' | 'card' | 'carousel-card' | 'grid') => (
    <SectionCard
      role={kind === 'carousel-card' ? undefined : 'listitem'}
      appearance="plain"
      padding="none"
      withBorder={false}
      data-post-list-item-layout={
        scoped ? (kind === 'card' ? 'cards' : kind === 'carousel-card' ? 'carousel-cards' : kind) : undefined
      }
    >
      {kind === 'grid' ? (
        <>
          {showImage ? <ItemMedia item={item} ratio={ratio} /> : null}
          <LayoutInset blockStart={showImage ? metrics.itemGap : 'none'}>{content(item, meta, kind)}</LayoutInset>
        </>
      ) : (
        <LayoutInline
          wrap="nowrap"
          gap={metrics.rowGap}
          align="start"
          data-post-list-carousel-card-layout={scoped && kind === 'carousel-card' ? '' : undefined}
        >
          {showImage ? (
            <ItemMedia
              item={item}
              ratio={ratio}
              thumbnail
              {...{ [`data-post-list-${kind === 'card' ? 'card' : kind}-media`]: scoped ? '' : undefined }}
            />
          ) : null}
          {content(item, meta, kind)}
        </LayoutInline>
      )}
    </SectionCard>
  );
  let body: ReactNode;
  if (!items.length) {
    body = (
      <LayoutInset block="xl">
        <SupportingText tone="secondary" align="center">
          {emptyLabel}
        </SupportingText>
      </LayoutInset>
    );
  } else if (layout === 'minimal') {
    body = (
      <LayoutStack gap="none">
        {items.map((item, index) => (
          <SectionCard
            role="listitem"
            key={item.id}
            appearance="plain"
            padding="none"
            border={index === items.length - 1 ? 'none' : 'block-end'}
            data-post-list-item-layout={scoped ? 'minimal' : undefined}
          >
            <LayoutInset block={metrics.rowInset}>{content(item, renderMinimalMeta?.(item), 'minimal')}</LayoutInset>
          </SectionCard>
        ))}
      </LayoutStack>
    );
  } else if (layout === 'list') {
    body = (
      <LayoutStack gap={metrics.rowGap}>
        {items.map((item) => (
          <Fragment key={item.id}>{card(item, renderListMeta?.(item), 'list')}</Fragment>
        ))}
      </LayoutStack>
    );
  } else if (layout === 'carousel') {
    const hero = columns === 1 && showImage;
    body = (
      <ListCarousel
        slideSize={hero ? '100%' : getResponsiveSlideSize(columns)}
        slideGap={metrics.rowGap}
        loop={carouselLoop}
        withIndicators={carouselIndicators && items.length > 1}
        withControls={items.length > 1 && (!hero || !isMobile)}
      >
        {items.map((item) => (
          <Fragment key={item.id}>
            {hero ? (
              <CollectionMedia hero data-hero-carousel-slide>
                <MediaImage item={item} sizes="100vw" />
                <ImageChrome placement="cover" shade="card" inset={{ base: 'md', sm: 'lg' }} justify="between">
                  <Heading
                    id={`${titleIdPrefix}-${item.id}`}
                    aria-label={item.title?.trim() ? undefined : tStates('untitled')}
                    contrast="image"
                    tone="inverse"
                    level={2}
                    scale={{ base: 3, sm: HERO_TITLE_SCALE[itemSize] }}
                    lines={2}
                  >
                    {item.title ?? ''}
                  </Heading>
                  <LayoutInline
                    wrap="wrap"
                    align="end"
                    justify="between"
                    data-hero-bottom-layout={isMobile ? 'row' : 'stack'}
                  >
                    <LayoutInset flexible space="none">
                      {renderHeroMeta?.(item, { mobile: Boolean(isMobile) })}
                    </LayoutInset>
                    <Button
                      href={item.href}
                      emphasis="medium"
                      size="sm"
                      aria-describedby={`${titleIdPrefix}-${item.id}`}
                    >
                      {tActions('view')}
                    </Button>
                  </LayoutInline>
                </ImageChrome>
              </CollectionMedia>
            ) : (
              card(item, renderCarouselCardMeta?.(item), 'carousel-card')
            )}
          </Fragment>
        ))}
      </ListCarousel>
    );
  } else {
    body = (
      <LayoutGrid
        minColumnWidth={collectionMinColumnWidth(layout, itemSize, trackScale)}
        columnGrowth={COLLECTION_COLUMN_GROWTH}
        gap={metrics.gridGap}
      >
        {items.map((item) => (
          <Fragment key={item.id}>
            {layout === 'cards'
              ? card(item, renderCardsMeta?.(item), 'card')
              : card(item, renderGridMeta?.(item), 'grid')}
          </Fragment>
        ))}
      </LayoutGrid>
    );
  }
  return (
    <div className={className}>
      <Collection size={itemSize} role={items.length && layout !== 'carousel' ? 'list' : undefined}>
        {body}
      </Collection>
    </div>
  );
}
