import type { MarqueeViewOptions } from './types';

const LEGACY_SPEEDS: Record<MarqueeViewOptions['speed'], number> = {
  slow: 6,
  normal: 12,
  fast: 24,
};

const LEGACY_ITEM_HEIGHTS: Record<MarqueeViewOptions['itemHeight'], number> = {
  sm: 18,
  md: 28,
  lg: 38,
  xl: 52,
};

export const MARQUEE_SPEED_MIN = 4;
export const MARQUEE_SPEED_MAX = 36;
export const MARQUEE_SPEED_STEP = 2;
export const MARQUEE_DEFAULT_SPEED = LEGACY_SPEEDS.normal;

export const MARQUEE_ITEM_HEIGHT_MIN = 16;
export const MARQUEE_ITEM_HEIGHT_MAX = 56;
export const MARQUEE_ITEM_HEIGHT_STEP = 2;
export const MARQUEE_DEFAULT_ITEM_HEIGHT = LEGACY_ITEM_HEIGHTS.md;

const MARQUEE_MIN_LANE_FILL_RATIO = 2;
export const MARQUEE_MAX_RENDERED_ITEMS_PER_LANE = 128;
export const MARQUEE_DEFAULT_GROUP_REPEAT_COUNT = 4;

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numeric));
}

export function resolveMarqueeSpeedPxPerSecond(
  speedPxPerSecond: unknown,
  legacySpeed: string | undefined = 'normal',
): number {
  const fallback =
    legacySpeed === 'slow' || legacySpeed === 'normal' || legacySpeed === 'fast'
      ? LEGACY_SPEEDS[legacySpeed]
      : MARQUEE_DEFAULT_SPEED;

  return clampNumber(speedPxPerSecond, MARQUEE_SPEED_MIN, MARQUEE_SPEED_MAX, fallback);
}

export function resolveMarqueeItemHeightPx(itemHeightPx: unknown, legacyItemHeight: string | undefined = 'md'): number {
  const fallback =
    legacyItemHeight === 'sm' || legacyItemHeight === 'md' || legacyItemHeight === 'lg' || legacyItemHeight === 'xl'
      ? LEGACY_ITEM_HEIGHTS[legacyItemHeight]
      : MARQUEE_DEFAULT_ITEM_HEIGHT;

  return clampNumber(itemHeightPx, MARQUEE_ITEM_HEIGHT_MIN, MARQUEE_ITEM_HEIGHT_MAX, fallback);
}

export function resolveMarqueeTextSizePx(itemHeightPx: number): number {
  return Math.min(24, Math.max(14, Math.round(itemHeightPx * 0.48)));
}

export function resolveMarqueeGroupRepeatCount(rootWidth: number, baseGroupWidth: number, itemCount: number): number {
  if (rootWidth <= 0 || baseGroupWidth <= 0 || itemCount <= 0) {
    return 1;
  }

  const requiredRepeatCount = Math.ceil((rootWidth * MARQUEE_MIN_LANE_FILL_RATIO) / baseGroupWidth);
  const maxRepeatCount = Math.max(1, Math.floor(MARQUEE_MAX_RENDERED_ITEMS_PER_LANE / itemCount));

  return Math.min(requiredRepeatCount, maxRepeatCount);
}

export function resolveMarqueeDurationSeconds(laneWidth: number, speedPxPerSecond: number): number {
  if (laneWidth <= 0 || speedPxPerSecond <= 0) {
    return 60;
  }

  return Math.max(8, Math.round((laneWidth / speedPxPerSecond) * 10) / 10);
}
