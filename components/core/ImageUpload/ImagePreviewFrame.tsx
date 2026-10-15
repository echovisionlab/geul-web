'use client';
import type { ClosedVisualProps } from '../visual-contract';
import type { CSSProperties, ReactNode } from 'react';
import classes from './ImageUpload.module.css';
export interface ImagePreviewFrameProps extends ClosedVisualProps {
  src?: string | null;
  alt: string;
  /** Authored media geometry, independent of control appearance. */
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  maxWidth?: CSSProperties['maxWidth'];
  maxHeight?: CSSProperties['maxHeight'];
  minHeight?: CSSProperties['minHeight'];
  aspectRatio?: CSSProperties['aspectRatio'];
  fit?: 'contain' | 'cover';
  shape?: 'square' | 'circle';
  surface?: 'default' | 'muted' | 'transparent';
  withBorder?: boolean;
  dropActive?: boolean;
  empty?: ReactNode;
  actions?: ReactNode;
  renderImage?: (props: { src: string; alt: string; style: CSSProperties }) => ReactNode;
}
export function ImagePreviewFrame({
  src,
  alt,
  width = '100%',
  height,
  maxWidth = '100%',
  maxHeight,
  minHeight,
  aspectRatio,
  fit = 'cover',
  shape = 'square',
  surface = 'default',
  withBorder = true,
  dropActive = false,
  empty,
  actions,
  renderImage,
}: ImagePreviewFrameProps) {
  const imageStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: fit,
    ...(aspectRatio ? { position: 'absolute', inset: 0 } : {}),
  };
  return (
    <div className={classes.wrapper} style={{ width, maxWidth }}>
      <div
        className={classes.frame}
        data-shape={shape}
        data-surface={surface}
        data-border={withBorder || undefined}
        data-drop-active={dropActive || undefined}
        style={{ height, maxHeight, minHeight, aspectRatio }}
      >
        {src ? (
          renderImage ? (
            renderImage({ src, alt, style: imageStyle })
          ) : (
            <img src={src} alt={alt} style={imageStyle} />
          )
        ) : (
          <div className={classes.empty}>{empty}</div>
        )}
      </div>
      {actions}
    </div>
  );
}
