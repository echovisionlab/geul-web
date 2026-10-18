import type { CollectionSize } from '@/components/core/Collection';
import type { LayoutMinColumnWidth, Responsive } from '@/components/core/Layout';

/**
 * Collection grids are fluid: the item size sets the card width and a row fits as many cards as the
 * width allows. From `md` cards keep exactly that width (spare space stays at the row end), so a grid
 * block and a list block of one size show their images at the same scale; below `md` the few columns
 * stretch to fill the screen. Horizontal `cards` are one step wider. `compact` collections (square artwork such as release
 * covers) start one step denser below `sm`, so phones show two covers per row. The authored column
 * count applies to carousels only (slides per view).
 */
const TRACKS: readonly LayoutMinColumnWidth[] = ['xs', 'sm', 'md', 'lg', 'xl'];
const SIZE_STEP: Record<CollectionSize, number> = { xs: 0, s: 1, m: 2, l: 3, xl: 4 };

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

export const COLLECTION_COLUMN_GROWTH: Responsive<'fill' | 'none'> = { base: 'fill', md: 'none' };
