import type { AvatarSize } from '../Display';
import type { Space } from '../Layout';
import type { TextSize } from '../Typography';

/** Item scale is independent of layout and the author's chosen column count. */
export const COLLECTION_SIZES = ['s', 'm', 'l'] as const;
export type CollectionSize = (typeof COLLECTION_SIZES)[number];
export const DEFAULT_COLLECTION_SIZE: CollectionSize = 'm';

export interface CollectionMetrics {
  titleSize: Extract<TextSize, 'sm' | 'md' | 'lg'>;
  metaSize: Extract<TextSize, 'xs' | 'sm'>;
  rowGap: Space;
  gridGap: Space;
  itemGap: Space;
  rowInset: Space;
  avatarSize: AvatarSize;
}

const metrics = {
  s: { titleSize: 'sm', metaSize: 'xs', rowGap: 'sm', gridGap: 'md', itemGap: 'xxs', rowInset: 'xs', avatarSize: 'md' },
  m: { titleSize: 'md', metaSize: 'sm', rowGap: 'md', gridGap: 'lg', itemGap: 'xs', rowInset: 'sm', avatarSize: 'lg' },
  l: { titleSize: 'lg', metaSize: 'sm', rowGap: 'xl', gridGap: 'xl', itemGap: 'sm', rowInset: 'md', avatarSize: 'xl' },
} as const satisfies Record<CollectionSize, CollectionMetrics>;

export function getCollectionMetrics(size: CollectionSize = DEFAULT_COLLECTION_SIZE): CollectionMetrics {
  if (!Object.hasOwn(metrics, size)) {
    throw new RangeError('Core Collection size must be s, m or l');
  }
  return metrics[size];
}
