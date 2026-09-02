'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Box, Text, useComputedColorScheme } from '@mantine/core';
import { toCdnUrl } from '@/lib/utils/file-url';
import { selectThemeAssetUrl } from '@/lib/utils/theme-asset';
import {
  MARQUEE_DEFAULT_GROUP_REPEAT_COUNT,
  resolveMarqueeDurationSeconds,
  resolveMarqueeGroupRepeatCount,
  resolveMarqueeItemHeightPx,
  resolveMarqueeSpeedPxPerSecond,
  resolveMarqueeTextSizePx,
} from './metrics';
import type { MarqueeResolvedItem, MarqueeViewOptions } from './types';
import classes from './MarqueeView.module.css';

const GAPS: Record<MarqueeViewOptions['gap'], string> = {
  sm: '16px',
  md: '32px',
  lg: '48px',
  xl: '72px',
};

interface MarqueeViewProps {
  items: MarqueeResolvedItem[];
  options: MarqueeViewOptions;
  emptyLabel?: string;
}

export function MarqueeView({ items, options, emptyLabel = '' }: MarqueeViewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [groupRepeatCount, setGroupRepeatCount] = useState(MARQUEE_DEFAULT_GROUP_REPEAT_COUNT);
  const [durationSeconds, setDurationSeconds] = useState(60);
  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        const hasLogo = Boolean(item.logoUrl || item.logoLightUrl || item.logoDarkUrl);
        return hasLogo || options.fallbackMode !== 'hide';
      }),
    [items, options.fallbackMode],
  );
  const groupRepeatIndexes = useMemo(
    () => Array.from({ length: groupRepeatCount }, (_, index) => index),
    [groupRepeatCount],
  );
  const speedPxPerSecond = resolveMarqueeSpeedPxPerSecond(options.speedPxPerSecond, options.speed);
  const itemHeightPx = resolveMarqueeItemHeightPx(options.itemHeightPx, options.itemHeight);

  useEffect(() => {
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!root || !measure) {
      return;
    }

    const updateRepeatCount = () => {
      const nextRepeatCount = resolveMarqueeGroupRepeatCount(
        root.clientWidth,
        measure.scrollWidth,
        visibleItems.length,
      );
      const laneWidth = measure.scrollWidth * nextRepeatCount;
      const nextDurationSeconds = resolveMarqueeDurationSeconds(laneWidth, speedPxPerSecond);
      setGroupRepeatCount((current) => (current === nextRepeatCount ? current : nextRepeatCount));
      setDurationSeconds((current) => (current === nextDurationSeconds ? current : nextDurationSeconds));
    };

    updateRepeatCount();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(updateRepeatCount);
    resizeObserver.observe(root);
    resizeObserver.observe(measure);

    return () => {
      resizeObserver.disconnect();
    };
  }, [itemHeightPx, options.gap, options.logoScale, speedPxPerSecond, visibleItems]);

  if (visibleItems.length === 0) {
    return emptyLabel ? (
      <Text size="sm" c="dimmed">
        {emptyLabel}
      </Text>
    ) : null;
  }

  const gap = GAPS[options.gap];
  const textSizePx = resolveMarqueeTextSizePx(itemHeightPx);

  return (
    <Box
      ref={rootRef}
      className={`${classes.root} marquee-block`}
      data-block-type="marquee"
      data-direction={options.direction}
      data-pause-on-hover={String(options.pauseOnHover)}
      data-logo-scale={options.logoScale ?? 'contain'}
      style={
        {
          '--marquee-duration': `${durationSeconds}s`,
          '--marquee-gap': gap,
          '--marquee-item-height': `${itemHeightPx}px`,
          '--marquee-text-size': `${textSizePx}px`,
        } as CSSProperties
      }
    >
      <Box ref={measureRef} className={`${classes.group} ${classes.measureGroup}`} aria-hidden>
        {visibleItems.map((item, index) => (
          <MarqueeItem key={`${item.id}-measure-${index}`} item={item} options={options} />
        ))}
      </Box>
      <Box className={classes.track}>
        <MarqueeLane repeatIndexes={groupRepeatIndexes} items={visibleItems} options={options} laneKey="primary" />
        <MarqueeLane
          repeatIndexes={groupRepeatIndexes}
          items={visibleItems}
          options={options}
          laneKey="clone"
          ariaHidden
        />
      </Box>
    </Box>
  );
}

function MarqueeLane({
  repeatIndexes,
  items,
  options,
  laneKey,
  ariaHidden = false,
}: {
  repeatIndexes: number[];
  items: MarqueeResolvedItem[];
  options: MarqueeViewOptions;
  laneKey: string;
  ariaHidden?: boolean;
}) {
  return (
    <Box className={classes.lane} aria-hidden={ariaHidden || undefined}>
      {repeatIndexes.map((repeatIndex) => (
        <MarqueeItemGroup
          key={`${laneKey}-${repeatIndex}`}
          items={items}
          options={options}
          keyPrefix={`${laneKey}-${repeatIndex}`}
        />
      ))}
    </Box>
  );
}

function MarqueeItemGroup({
  items,
  options,
  keyPrefix = 'group',
}: {
  items: MarqueeResolvedItem[];
  options: MarqueeViewOptions;
  keyPrefix?: string;
}) {
  return (
    <Box className={classes.group}>
      {items.map((item, index) => (
        <MarqueeItem key={`${keyPrefix}-${item.id}-${index}`} item={item} options={options} />
      ))}
    </Box>
  );
}

function MarqueeItem({ item, options }: { item: MarqueeResolvedItem; options: MarqueeViewOptions }) {
  const hasLogo = Boolean(item.logoUrl || item.logoLightUrl || item.logoDarkUrl);
  const content = hasLogo ? <MarqueeLogoImage item={item} /> : <span className={classes.text}>{item.text}</span>;

  if (!item.href) {
    return <span className={classes.item}>{content}</span>;
  }

  const target = options.linkTarget === 'new-tab' ? '_blank' : undefined;
  const rel = target ? 'noreferrer' : undefined;

  return (
    <a className={`${classes.item} ${classes.link}`} href={item.href} target={target} rel={rel}>
      {content}
    </a>
  );
}

function MarqueeLogoImage({ item }: { item: MarqueeResolvedItem }) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const colorScheme = useComputedColorScheme('light');
  const url = selectThemeAssetUrl(colorScheme, {
    lightUrl: item.logoLightUrl,
    darkUrl: item.logoDarkUrl,
    fallbackUrl: item.logoUrl,
  });
  const [sizeFallbackUrl, setSizeFallbackUrl] = useState<string | null>(null);
  const needsSizeFallback = Boolean(url && sizeFallbackUrl === url);

  // Some production SVG logos load with valid natural dimensions but collapse
  // to a 0x0 CSS box when rendered with only width:auto and max-height.
  // Detect that case after load, per selected theme URL, so normal contain
  // logos keep their intrinsic sizing instead of behaving like fill-height.
  const checkRenderedSize = () => {
    const img = imgRef.current;
    if (!url || !img || needsSizeFallback || img.naturalWidth === 0 || img.naturalHeight === 0) {
      return;
    }
    const rect = img.getBoundingClientRect();
    const itemRect = img.parentElement?.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || !itemRect || itemRect.width === 0 || itemRect.height === 0) {
      setSizeFallbackUrl(url);
    }
  };

  useEffect(() => {
    checkRenderedSize();
  });

  if (!url) {
    return null;
  }

  return (
    <Box
      ref={imgRef}
      component="img"
      src={toCdnUrl(url)}
      alt={item.text}
      className={classes.logo}
      data-size-fallback={needsSizeFallback ? 'true' : undefined}
      onLoad={checkRenderedSize}
    />
  );
}
