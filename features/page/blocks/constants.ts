/**
 * Shared constants for page blocks.
 * Centralized to avoid duplication across block editors.
 */

// ============================================================================
// Column Options
// ============================================================================

export const COLUMN_OPTIONS = [
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
] as const;

export const SLIDES_TO_SHOW_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
] as const;

// ============================================================================
// Layout Options
// ============================================================================

export function getLayoutOptionsGridList(labels: { grid: string; list: string }) {
  return [
    {
      value: 'grid',
      label: labels.grid,
    },
    {
      value: 'list',
      label: labels.list,
    },
  ] as const;
}

export function getLayoutOptionsGridCarousel(labels: { grid: string; carousel: string }) {
  return [
    {
      value: 'grid',
      label: labels.grid,
    },
    {
      value: 'carousel',
      label: labels.carousel,
    },
  ] as const;
}

export function getLayoutOptionsPostList(labels: {
  grid: string;
  list: string;
  cards: string;
  minimal: string;
  carousel: string;
}) {
  return [
    {
      value: 'grid',
      label: labels.grid,
    },
    {
      value: 'list',
      label: labels.list,
    },
    {
      value: 'cards',
      label: labels.cards,
    },
    {
      value: 'minimal',
      label: labels.minimal,
    },
    {
      value: 'carousel',
      label: labels.carousel,
    },
  ] as const;
}

// ============================================================================
// Aspect Ratio Options
// ============================================================================

export function getAspectRatioOptions(labels: { auto: string }) {
  return [
    { value: '16:9', label: '16:9' },
    { value: '4:3', label: '4:3' },
    { value: '1:1', label: '1:1' },
    {
      value: 'auto',
      label: labels.auto,
    },
  ] as const;
}

// ============================================================================
// Sort Options
// ============================================================================

export function getSortByOptions(labels: { published: string; updated: string; title: string }) {
  return [
    { value: 'published_at', label: labels.published },
    { value: 'updated_at', label: labels.updated },
    { value: 'title', label: labels.title },
  ] as const;
}

export function getSortOrderOptions(labels: { newest: string; oldest: string }) {
  return [
    {
      value: 'desc',
      label: labels.newest,
    },
    {
      value: 'asc',
      label: labels.oldest,
    },
  ] as const;
}

export function getArtistGridSortByOptions(labels: { name: string; dateAdded: string }) {
  return [
    { value: 'name', label: labels.name },
    {
      value: 'created_at',
      label: labels.dateAdded,
    },
  ] as const;
}

export function getArtistGridSortOrderOptions(labels: { azOldest: string; zaNewest: string }) {
  return [
    {
      value: 'asc',
      label: labels.azOldest,
    },
    {
      value: 'desc',
      label: labels.zaNewest,
    },
  ] as const;
}

// ============================================================================
// Map Label Options
// ============================================================================

export const MAP_PRIMARY_LABEL_VALUES = ['content_title', 'place_name'] as const;

export type MapPrimaryLabelValue = (typeof MAP_PRIMARY_LABEL_VALUES)[number];

export function getMapPrimaryLabelOptions(labels: { content: string; placeName: string }): ReadonlyArray<{
  value: MapPrimaryLabelValue;
  label: string;
}> {
  return [
    { value: 'content_title', label: labels.content },
    {
      value: 'place_name',
      label: labels.placeName,
    },
  ];
}

export function getMapColorSchemeOptions(labels: { auto: string; light: string; dark: string }) {
  return [
    {
      value: 'auto',
      label: labels.auto,
    },
    {
      value: 'light',
      label: labels.light,
    },
    {
      value: 'dark',
      label: labels.dark,
    },
  ] as const;
}

export function getMapLabelModeOptions(labels: { inherit: string; show: string; hide: string }) {
  return [
    {
      value: 'inherit',
      label: labels.inherit,
    },
    {
      value: 'show',
      label: labels.show,
    },
    {
      value: 'hide',
      label: labels.hide,
    },
  ] as const;
}

export function resolveMapPrimaryLabel(
  primaryLabel: MapPrimaryLabelValue,
  contentTitle: string,
  placeName: string,
): string {
  return primaryLabel === 'place_name' ? placeName : contentTitle;
}

// ============================================================================
// Limits
// ============================================================================

export const MAX_LIMIT_POSTS = 50;
export const MAX_LIMIT_AUTHORS = 24;
export const MAX_LIMIT_WORKS = 24;
export const MAX_LIMIT_RELEASES = 24;
export const MAX_LIMIT_ARTISTS = 24;

// ============================================================================
// Carousel Slide Size Calculator
// ============================================================================

/**
 * Calculate the slide size percentage for carousels.
 */
export function getSlideSize(columns: number): string {
  switch (columns) {
    case 1:
      return '100%';
    case 2:
      return '50%';
    case 3:
      return '33.333%';
    case 4:
      return '25%';
    default:
      return '33.333%';
  }
}

/**
 * Get responsive slide sizes for Mantine Carousel.
 */
export function getResponsiveSlideSize(columns: number): {
  base: string;
  sm: string;
  md: string;
} {
  return {
    base: '100%',
    sm: columns === 1 ? '100%' : '50%',
    md: getSlideSize(columns),
  };
}
