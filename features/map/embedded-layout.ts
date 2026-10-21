import type { CSSProperties } from 'react';
import { displaySizeInlineSize } from '@/components/core/ResizeHandle/display-size';
import { normalizeMediaTextAlignment } from '@/lib/media/shared';

export function resolveMapEmbeddedContainerStyle(input: {
  displaySize: number;
  /** Width / height of the map frame; it also caps the map's height. */
  aspectRatio?: number;
  blockAlignment?: string;
  applyDisplaySize: boolean;
  isMobileViewport: boolean;
}): CSSProperties {
  const sizedWidth =
    input.applyDisplaySize && !input.isMobileViewport
      ? displaySizeInlineSize(input.displaySize, input.aspectRatio)
      : undefined;
  const style: CSSProperties = {
    width: sizedWidth ?? '100%',
    maxWidth: '100%',
  };

  if (!sizedWidth) {
    return style;
  }

  const alignment = normalizeMediaTextAlignment(input.blockAlignment);
  if (alignment === 'center') {
    style.marginLeft = 'auto';
    style.marginRight = 'auto';
    return style;
  }

  if (alignment === 'right') {
    style.marginLeft = 'auto';
    style.marginRight = '0';
    return style;
  }

  style.marginLeft = '0';
  style.marginRight = 'auto';
  return style;
}
