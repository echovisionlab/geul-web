'use client';

import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import { Box } from '@mantine/core';

type ImagePreviewFit = 'contain' | 'cover';

interface ImagePreviewFrameProps {
  src?: string | null;
  alt: string;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  maxWidth?: CSSProperties['maxWidth'];
  maxHeight?: CSSProperties['maxHeight'];
  minHeight?: CSSProperties['minHeight'];
  aspectRatio?: CSSProperties['aspectRatio'];
  fit?: ImagePreviewFit;
  radius?: CSSProperties['borderRadius'];
  background?: CSSProperties['background'];
  border?: CSSProperties['border'];
  dropActive?: boolean;
  interactive?: boolean;
  empty?: ReactNode;
  actions?: ReactNode;
  onClick?: MouseEventHandler<HTMLDivElement>;
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
  radius,
  background,
  border,
  dropActive = false,
  interactive = false,
  empty,
  actions,
  onClick,
  renderImage,
}: ImagePreviewFrameProps) {
  const resolvedBorder =
    border ?? `1px solid ${dropActive ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-default-border)'}`;
  const imageStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: fit,
  };

  return (
    <Box pos="relative" w={width} maw={maxWidth} style={{ minWidth: 0 }}>
      <Box
        onClick={onClick}
        style={{
          position: 'relative',
          width: '100%',
          height,
          maxHeight,
          minHeight,
          aspectRatio,
          overflow: 'hidden',
          borderRadius: radius,
          border: resolvedBorder,
          background: background ?? 'var(--mantine-color-body)',
          cursor: interactive ? 'pointer' : 'default',
        }}
      >
        {src ? (
          renderImage ? (
            renderImage({ src, alt, style: imageStyle })
          ) : (
            <img src={src} alt={alt} style={imageStyle} />
          )
        ) : (
          <Box
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
            }}
          >
            {empty}
          </Box>
        )}
      </Box>
      {actions}
    </Box>
  );
}
