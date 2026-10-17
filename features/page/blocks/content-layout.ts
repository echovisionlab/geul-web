import type { CollectionSize } from '@/components/core/Collection';
import type { LayoutMinColumnWidth, Responsive } from '@/components/core/Layout';

/**
 * Collection grids are fluid: the item size sets the minimum card width and a row fits as many cards
 * as the width allows, so cards keep their scale on wide screens instead of stretching to a fixed
 * count. Horizontal `cards` are one step wider. `compact` collections (square artwork such as release
 * covers) start one step denser below `sm`, so phones show two covers per row. The authored column
 * count applies to carousels only (slides per view).
 */
const TRACKS: readonly LayoutMinColumnWidth[] = ['sm', 'md', 'lg'];
const SIZE_STEP: Record<CollectionSize, number> = { s: 0, m: 1, l: 2 };

export type CollectionTrackScale = 'standard' | 'compact';

function track(step: number): LayoutMinColumnWidth {
  return TRACKS[Math.min(Math.max(step, 0), TRACKS.length - 1)];
}

export function collectionMinColumnWidth(
  layout: string,
  size: CollectionSize = 'm',
  scale: CollectionTrackScale = 'standard',
): Responsive<LayoutMinColumnWidth> {
  const step = SIZE_STEP[size] + (layout === 'cards' ? 1 : 0);
  return scale === 'compact' ? { base: track(step - 1), sm: track(step) } : track(step);
}
