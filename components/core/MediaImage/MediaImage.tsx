'use client';

import { forwardRef, useState, type SyntheticEvent } from 'react';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import classes from './MediaImage.module.css';

/** Media dimensions describe authored content geometry; interface skins remain Core owned. */
export type MediaDimension = number | '100%' | 'auto';
export interface MediaImageProps extends Omit<PresentationProps, 'children' | 'onError' | 'onLoad'> {
  src?: string | null;
  alt: string;
  fallbackSrc?: string;
  fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  width?: MediaDimension;
  height?: MediaDimension;
  maxHeight?: number;
  fill?: boolean;
  loading?: 'eager' | 'lazy';
  decoding?: 'async' | 'sync' | 'auto';
  onError?: (event: SyntheticEvent<HTMLImageElement>) => void;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
}
export const MediaImage = forwardRef<HTMLImageElement, MediaImageProps>(
  (
    {
      src,
      alt,
      fallbackSrc,
      fit = 'cover',
      width,
      height,
      maxHeight,
      fill,
      loading,
      decoding,
      onError,
      onLoad,
      ...props
    },
    ref,
  ) => {
    const [failedSource, setFailedSource] = useState<string | null>(null);
    const source = src && src !== failedSource ? src : fallbackSrc;
    const dimension = (value: MediaDimension | undefined) =>
      typeof value === 'number'
        ? Number.isFinite(value) && value >= 0
          ? value
          : undefined
        : value === '100%' || value === 'auto'
          ? value
          : undefined;
    return (
      <img
        {...presentationAttributes(props)}
        ref={ref}
        src={source || undefined}
        alt={alt}
        loading={loading}
        decoding={decoding}
        className={classes.image}
        data-geul-media-image=""
        data-geul-media-fill={fill || undefined}
        style={{
          objectFit: ['cover', 'contain', 'fill', 'none', 'scale-down'].includes(fit) ? fit : 'cover',
          width: dimension(width),
          height: dimension(height),
          maxHeight:
            typeof maxHeight === 'number' && Number.isFinite(maxHeight) && maxHeight >= 0 ? maxHeight : undefined,
        }}
        onError={(event) => {
          if (source === src && src) {
            setFailedSource(src);
          }
          onError?.(event);
        }}
        onLoad={onLoad}
      />
    );
  },
);
