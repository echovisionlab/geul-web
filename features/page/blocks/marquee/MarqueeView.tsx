'use client';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { resolveSiteVariableHref, siteVariableContext } from '@/lib/site-variables';
import { Button } from '@/components/core/Button';
import Link from '@/components/core/Navigation';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';
import { SupportingText } from '@/components/core/Typography';
import { useReducedMotion } from '@mantine/hooks';
import { useTranslations } from 'next-intl';
import { useComputedColorScheme } from '@/lib/providers/DesignSystemProvider';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
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
  const t = useTranslations('common.motion');
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const staticContent = paused || Boolean(reducedMotion);
  const contentId = useId();
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
    return emptyLabel ? <SupportingText tone="secondary">{emptyLabel}</SupportingText> : null;
  }
  const gap = GAPS[options.gap];
  const textSizePx = resolveMarqueeTextSizePx(itemHeightPx);
  return (
    <LayoutStack gap="xs">
      {!reducedMotion ? (
        <LayoutInline>
          <Button aria-controls={contentId} onClick={() => setPaused((current) => !current)}>
            {t(paused ? 'resume' : 'pause')}
          </Button>
        </LayoutInline>
      ) : null}
      <div
        id={contentId}
        ref={rootRef}
        className={`${classes.root} marquee-block`}
        data-block-type="marquee"
        data-direction={options.direction}
        data-pause-on-hover={String(options.pauseOnHover)}
        data-logo-scale={options.logoScale ?? 'contain'}
        data-motion-paused={staticContent ? 'true' : 'false'}
        data-static={staticContent ? 'true' : 'false'}
        style={
          {
            '--_marquee-duration': `${durationSeconds}s`,
            '--_marquee-gap': gap,
            '--_marquee-item-height': `${itemHeightPx}px`,
            '--_marquee-text-size': `${textSizePx}px`,
          } as CSSProperties
        }
      >
        <div ref={measureRef} className={`${classes.group} ${classes.measureGroup}`} aria-hidden inert>
          {visibleItems.map((item, index) => (
            <MarqueeItem key={`${item.id}-measure-${index}`} item={item} options={options} />
          ))}
        </div>
        <div className={classes.track} aria-hidden={staticContent || undefined} inert={staticContent || undefined}>
          <MarqueeLane repeatIndexes={groupRepeatIndexes} items={visibleItems} options={options} laneKey="primary" />
          <MarqueeLane
            repeatIndexes={groupRepeatIndexes}
            items={visibleItems}
            options={options}
            laneKey="clone"
            ariaHidden
          />
        </div>
        {staticContent ? (
          <div className={classes.staticGroup} data-marquee-static-items>
            {visibleItems.map((item) => (
              <MarqueeItem key={item.id} item={item} options={options} />
            ))}
          </div>
        ) : null}
      </div>
    </LayoutStack>
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
    <div className={classes.lane} aria-hidden={ariaHidden || undefined}>
      {repeatIndexes.map((repeatIndex) => (
        <MarqueeItemGroup
          key={`${laneKey}-${repeatIndex}`}
          items={items}
          options={options}
          keyPrefix={`${laneKey}-${repeatIndex}`}
          decorative={ariaHidden || repeatIndex > 0}
        />
      ))}
    </div>
  );
}
function MarqueeItemGroup({
  items,
  options,
  keyPrefix = 'group',
  decorative = false,
}: {
  items: MarqueeResolvedItem[];
  options: MarqueeViewOptions;
  keyPrefix?: string;
  decorative?: boolean;
}) {
  return (
    <div className={classes.group} aria-hidden={decorative || undefined} inert={decorative || undefined}>
      {items.map((item, index) => (
        <MarqueeItem key={`${keyPrefix}-${item.id}-${index}`} item={item} options={options} />
      ))}
    </div>
  );
}
function MarqueeItem({ item, options }: { item: MarqueeResolvedItem; options: MarqueeViewOptions }) {
  const { settings } = useSiteSettings();
  const href = resolveSiteVariableHref(item.href ?? '', siteVariableContext(settings));
  const hasLogo = Boolean(item.logoUrl || item.logoLightUrl || item.logoDarkUrl);
  const content = hasLogo ? <MarqueeLogoImage item={item} /> : <span className={classes.text}>{item.text}</span>;
  if (!href) {
    return <span className={classes.item}>{content}</span>;
  }
  const target = options.linkTarget === 'new-tab' ? '_blank' : undefined;
  const rel = target ? 'noreferrer' : undefined;
  return (
    <span className={classes.item}>
      <Link
        href={href}
        target={target}
        rel={rel}
        appearance={hasLogo ? 'graphic' : 'quiet'}
        tone="inherit"
        prefetch={false}
      >
        {content}
      </Link>
    </span>
  );
}
function MarqueeLogoImage({ item }: { item: MarqueeResolvedItem }) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const colorScheme = useComputedColorScheme();
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
    <img
      ref={imgRef}
      src={toCdnUrl(url)}
      alt={item.text}
      className={classes.logo}
      data-size-fallback={needsSizeFallback ? 'true' : undefined}
      onLoad={checkRenderedSize}
    />
  );
}
