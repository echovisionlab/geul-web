import type { CSSProperties } from 'react';
import { normalizeMediaTextAlignment } from '@/lib/media/shared';

export function resolveMapEmbeddedContainerStyle(input: {
  previewWidth: number;
  blockAlignment?: string;
  applyPreviewWidth: boolean;
  isMobileViewport: boolean;
}): CSSProperties {
  const shouldApplyWidth = input.applyPreviewWidth && !input.isMobileViewport;
  const style: CSSProperties = {
    width: shouldApplyWidth ? `${input.previewWidth}%` : '100%',
    maxWidth: '100%',
  };

  if (!shouldApplyWidth || input.previewWidth >= 100) {
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
