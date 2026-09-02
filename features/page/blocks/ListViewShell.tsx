'use client';

import type { ReactNode } from 'react';
import NextImage from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Carousel } from '@mantine/carousel';
import { Box, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Button } from '@/components/core/Button';
import { ContentCard, ContentCardSection } from '@/components/core/Section';
import { getResponsiveSlideSize } from './constants';
import { toAspectRatio } from './list-shared';
import classes from './post-list/PostListCard.module.css';

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
  columns: number;
  showImage: boolean;
  imageAspectRatio?: string;
  carouselLoop: boolean;
  carouselIndicators: boolean;
  gridCols?: {
    base: number;
    sm: number;
  };
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

function dataProps(scope: ListViewShellProps<ListViewShellItem>['dataScope'], attribute: string, value?: string) {
  if (scope !== 'post-list') {
    return {};
  }

  return value === undefined ? { [attribute]: '' } : { [attribute]: value };
}

function TitleLink<T extends ListViewShellItem>({
  item,
  lineClamp = 2,
  size,
}: {
  item: T;
  lineClamp?: number;
  size?: string;
}) {
  return (
    <Link href={item.href} className={classes.cardTitleLink}>
      <Box className={classes.cardTitleWrap}>
        <Text fw={500} size={size} lineClamp={lineClamp} className={classes.cardTitleText}>
          {item.title ?? ''}
        </Text>
      </Box>
    </Link>
  );
}

function MediaLink<T extends ListViewShellItem>({ item, children }: { item: T; children: ReactNode }) {
  return (
    <Link href={item.href} className={classes.mediaLink} aria-label={item.title ?? undefined} tabIndex={-1}>
      {children}
    </Link>
  );
}

function isSvgImageUrl(src: string) {
  const [pathname] = src.split(/[?#]/);
  return pathname.toLowerCase().endsWith('.svg');
}

function hasSvgImage<T extends ListViewShellItem>(item: T) {
  return Boolean(item.imageUrl && isSvgImageUrl(item.imageUrl));
}

function mediaFrameBackgroundColor<T extends ListViewShellItem>(item: T) {
  return hasSvgImage(item) ? 'transparent' : 'var(--mantine-color-gray-2)';
}

function mediaImageFitStyle<T extends ListViewShellItem>(item: T) {
  return {
    objectFit: hasSvgImage(item) ? 'contain' : 'cover',
    objectPosition: 'center',
  } as const;
}

function MediaImage<T extends ListViewShellItem>({ item, className }: { item: T; className?: string }) {
  if (!item.imageUrl) {
    return null;
  }

  return (
    <NextImage
      src={item.imageUrl}
      alt={item.imageAlt ?? item.title ?? ''}
      fill
      sizes="(max-width: 48em) 50vw, (max-width: 75em) 33vw, 25vw"
      unoptimized={hasSvgImage(item)}
      className={className}
      style={mediaImageFitStyle(item)}
    />
  );
}

export function ListViewShell<T extends ListViewShellItem>({
  items,
  className,
  emptyLabel,
  layout,
  columns,
  showImage,
  imageAspectRatio = '16:9',
  carouselLoop,
  carouselIndicators,
  gridCols = { base: 1, sm: 2 },
  dataScope,
  renderListMeta,
  renderMinimalMeta,
  renderCardsMeta,
  renderGridMeta,
  renderCarouselCardMeta,
  renderHeroMeta,
}: ListViewShellProps<T>) {
  const tActions = useTranslations('common.actions');
  const isMobile = useMediaQuery('(max-width: 48em)');
  const aspectRatio = toAspectRatio(imageAspectRatio, '16:9');

  if (!items.length) {
    return (
      <Text c="dimmed" ta="center" py="xl" className={className}>
        {emptyLabel}
      </Text>
    );
  }

  if (layout === 'list') {
    return (
      <Stack gap="md" className={className}>
        {items.map((item) => {
          const meta = renderListMeta?.(item);

          return (
            <ContentCard
              key={item.id}
              padding={0}
              radius={0}
              withBorder={false}
              style={{ background: 'transparent' }}
              className={classes.listItem}
              {...dataProps(dataScope, 'data-post-list-item-layout', 'list')}
            >
              <Box className={classes.listRow}>
                {showImage ? (
                  <Box
                    className={`${classes.listMedia} ${classes.hoverMedia}`}
                    style={{ backgroundColor: mediaFrameBackgroundColor(item) }}
                    {...dataProps(dataScope, 'data-post-list-list-media')}
                  >
                    <MediaLink item={item}>
                      <MediaImage item={item} className={classes.mediaImage} />
                    </MediaLink>
                  </Box>
                ) : null}
                <Stack gap={6} className={classes.listContent} {...dataProps(dataScope, 'data-post-list-list-content')}>
                  <TitleLink item={item} lineClamp={1} />
                  {hasNode(meta) ? (
                    <Stack gap={6} {...dataProps(dataScope, 'data-post-list-list-meta')}>
                      {meta}
                    </Stack>
                  ) : null}
                </Stack>
              </Box>
            </ContentCard>
          );
        })}
      </Stack>
    );
  }

  if (layout === 'minimal') {
    return (
      <Stack gap={0} className={className}>
        {items.map((item) => {
          const meta = renderMinimalMeta?.(item);

          return (
            <ContentCard
              key={item.id}
              padding={0}
              radius={0}
              withBorder={false}
              style={{ background: 'transparent' }}
              className={classes.minimalItem}
              {...dataProps(dataScope, 'data-post-list-item-layout', 'minimal')}
            >
              <Stack
                gap={2}
                className={classes.minimalContent}
                {...dataProps(dataScope, 'data-post-list-minimal-content')}
              >
                <TitleLink item={item} lineClamp={1} size="sm" />
                {hasNode(meta) ? <Box {...dataProps(dataScope, 'data-post-list-minimal-meta')}>{meta}</Box> : null}
              </Stack>
            </ContentCard>
          );
        })}
      </Stack>
    );
  }

  if (layout === 'cards') {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, md: columns }} spacing="lg" className={className}>
        {items.map((item) => {
          const meta = renderCardsMeta?.(item);

          return (
            <ContentCard
              key={item.id}
              padding={0}
              radius={0}
              withBorder={false}
              style={{ background: 'transparent' }}
              className={classes.cardItem}
              {...dataProps(dataScope, 'data-post-list-item-layout', 'cards')}
            >
              <Box
                style={{
                  display: 'grid',
                  gridTemplateColumns: showImage ? '112px minmax(0, 1fr)' : '1fr',
                  gap: '1rem',
                  alignItems: 'stretch',
                }}
              >
                {showImage ? (
                  <Box
                    style={{
                      position: 'relative',
                      width: 112,
                      minWidth: 112,
                      aspectRatio: '4 / 3',
                      backgroundColor: mediaFrameBackgroundColor(item),
                    }}
                    className={classes.hoverMedia}
                    {...dataProps(dataScope, 'data-post-list-card-media')}
                  >
                    <MediaLink item={item}>
                      <MediaImage item={item} className={classes.mediaImage} />
                    </MediaLink>
                  </Box>
                ) : null}

                <Stack
                  gap={8}
                  style={{
                    minWidth: 0,
                    height: '100%',
                  }}
                  {...dataProps(dataScope, 'data-post-list-card-content')}
                >
                  <TitleLink item={item} lineClamp={2} />
                  {hasNode(meta) ? (
                    <Stack gap={2} {...dataProps(dataScope, 'data-post-list-card-meta')}>
                      {meta}
                    </Stack>
                  ) : null}
                </Stack>
              </Box>
            </ContentCard>
          );
        })}
      </SimpleGrid>
    );
  }

  if (layout === 'carousel') {
    const isHeroStyle = columns === 1;
    const heroWithControls = items.length > 1 && !isMobile;
    const heroWithIndicators = items.length > 1;

    if (isHeroStyle) {
      return (
        <Carousel
          slideSize="100%"
          slideGap="md"
          emblaOptions={{ loop: carouselLoop }}
          withIndicators={heroWithIndicators}
          withControls={heroWithControls}
          className={className}
          classNames={{
            root: classes.heroCarousel,
            indicators: classes.heroCarouselIndicators,
            indicator: classes.heroCarouselIndicator,
          }}
        >
          {items.map((item) => {
            const heroMeta = renderHeroMeta?.(item, { mobile: Boolean(isMobile) });

            return (
              <Carousel.Slide key={item.id}>
                <Box
                  className={classes.heroCarouselSlide}
                  data-hero-carousel-slide
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {item.imageUrl ? (
                    <NextImage
                      src={item.imageUrl}
                      alt={item.imageAlt ?? item.title ?? ''}
                      fill
                      sizes="100vw"
                      unoptimized={hasSvgImage(item)}
                      style={mediaImageFitStyle(item)}
                    />
                  ) : (
                    <Box
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'var(--mantine-color-gray-7)',
                      }}
                    />
                  )}

                  <Box className={classes.heroOverlayShade} />

                  <Box className={classes.heroOverlayContent}>
                    <Stack gap="xs" className={classes.heroTopContent}>
                      <Text
                        component="h2"
                        fw={800}
                        fz={isMobile ? '1.5rem' : '2.75rem'}
                        lh={1.02}
                        style={{ color: 'white', margin: 0 }}
                        lineClamp={2}
                      >
                        {item.title ?? ''}
                      </Text>
                    </Stack>

                    {isMobile ? (
                      <Group
                        wrap="nowrap"
                        align="flex-end"
                        justify="space-between"
                        className={classes.heroBottomRow}
                        data-hero-bottom-layout="row"
                      >
                        <Box className={classes.heroMetaWrap}>{hasNode(heroMeta) ? heroMeta : null}</Box>
                        <Button
                          component={Link}
                          href={item.href}
                          emphasis="strong"
                          size="sm"
                          className={classes.heroReadMoreButton}
                        >
                          {tActions('view')}
                        </Button>
                      </Group>
                    ) : (
                      <Stack gap="xs" className={classes.heroBottomContent} data-hero-bottom-layout="stack">
                        {hasNode(heroMeta) ? heroMeta : null}
                        <Button
                          component={Link}
                          href={item.href}
                          emphasis="strong"
                          size="sm"
                          className={classes.heroReadMoreButton}
                        >
                          {tActions('view')}
                        </Button>
                      </Stack>
                    )}
                  </Box>
                </Box>
              </Carousel.Slide>
            );
          })}
        </Carousel>
      );
    }

    return (
      <Carousel
        slideSize={getResponsiveSlideSize(columns)}
        slideGap="md"
        emblaOptions={{ loop: carouselLoop }}
        withIndicators={carouselIndicators}
        withControls={items.length > 1}
        className={className}
      >
        {items.map((item) => {
          const meta = renderCarouselCardMeta?.(item);

          return (
            <Carousel.Slide key={item.id}>
              <ContentCard
                padding="lg"
                radius={0}
                withBorder
                style={{ height: '100%' }}
                className={classes.galleryCard}
                {...dataProps(dataScope, 'data-post-list-item-layout', 'carousel-cards')}
              >
                <Box
                  className={classes.carouselCardLayout}
                  style={{
                    gridTemplateColumns: showImage ? undefined : '1fr',
                  }}
                  {...dataProps(dataScope, 'data-post-list-carousel-card-layout')}
                >
                  {showImage ? (
                    <Box
                      className={classes.carouselCardMedia}
                      style={{ backgroundColor: mediaFrameBackgroundColor(item) }}
                      {...dataProps(dataScope, 'data-post-list-carousel-card-media')}
                    >
                      {item.imageUrl ? (
                        <NextImage
                          src={item.imageUrl}
                          alt={item.imageAlt ?? item.title ?? ''}
                          fill
                          sizes="(max-width: 48em) 100vw, 320px"
                          unoptimized={hasSvgImage(item)}
                          style={mediaImageFitStyle(item)}
                        />
                      ) : null}
                    </Box>
                  ) : null}

                  <Stack
                    gap="xs"
                    className={classes.carouselCardContent}
                    {...dataProps(dataScope, 'data-post-list-carousel-card-content')}
                  >
                    <TitleLink item={item} lineClamp={2} />
                    {hasNode(meta) ? meta : null}
                  </Stack>
                </Box>
              </ContentCard>
            </Carousel.Slide>
          );
        })}
      </Carousel>
    );
  }

  return (
    <SimpleGrid cols={{ base: gridCols.base, sm: gridCols.sm, md: columns }} spacing="lg" className={className}>
      {items.map((item) => {
        const meta = renderGridMeta?.(item);

        return (
          <ContentCard
            key={item.id}
            padding={0}
            radius={0}
            withBorder={false}
            style={{ background: 'transparent' }}
            className={classes.cardItem}
            {...dataProps(dataScope, 'data-post-list-item-layout', 'grid')}
          >
            {showImage ? (
              <ContentCardSection style={{ position: 'relative', aspectRatio }} className={classes.hoverMedia}>
                <MediaLink item={item}>
                  {item.imageUrl ? (
                    <MediaImage item={item} className={classes.mediaImage} />
                  ) : (
                    <div
                      className={classes.mediaPlaceholder}
                      style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'var(--mantine-color-gray-2)',
                      }}
                    />
                  )}
                </MediaLink>
              </ContentCardSection>
            ) : null}

            <Stack gap={8} mt={showImage ? 8 : 0} {...dataProps(dataScope, 'data-post-list-grid-content')}>
              <TitleLink item={item} lineClamp={2} />
              {hasNode(meta) ? (
                <Stack gap={2} {...dataProps(dataScope, 'data-post-list-grid-meta')}>
                  {meta}
                </Stack>
              ) : null}
            </Stack>
          </ContentCard>
        );
      })}
    </SimpleGrid>
  );
}
