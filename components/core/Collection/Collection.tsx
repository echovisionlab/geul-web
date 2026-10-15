import { forwardRef } from 'react';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import { getCollectionMetrics, type CollectionSize } from './collection-contract';
import classes from './Collection.module.css';

export interface CollectionProps extends PresentationProps {
  size?: CollectionSize;
  'data-core-collection-size'?: never;
}

/** Shared media geometry and item scale for content collections. */
export const Collection = forwardRef<HTMLDivElement, CollectionProps>(({ size = 'm', children, ...props }, ref) => {
  getCollectionMetrics(size);
  return (
    <div {...presentationAttributes(props)} ref={ref} className={classes.collection} data-core-collection-size={size}>
      {children}
    </div>
  );
});
Collection.displayName = 'Collection';

export interface CollectionMediaProps extends PresentationProps {
  width?: 'full' | 'thumbnail';
  aspectRatio?: '16:9' | '4:3' | '1:1' | 'auto';
  backdrop?: 'muted' | 'transparent';
  hero?: boolean;
}

export const CollectionMedia = forwardRef<HTMLDivElement, CollectionMediaProps>(
  ({ children, width = 'full', aspectRatio = '16:9', backdrop = 'muted', hero = false, ...props }, ref) => (
    <div
      {...presentationAttributes(props)}
      ref={ref}
      className={classes.media}
      data-width={width}
      data-backdrop={backdrop}
      data-hero={hero || undefined}
      style={hero ? undefined : { aspectRatio: aspectRatio === 'auto' ? 'auto' : aspectRatio.replace(':', ' / ') }}
    >
      {children}
    </div>
  ),
);
CollectionMedia.displayName = 'CollectionMedia';
