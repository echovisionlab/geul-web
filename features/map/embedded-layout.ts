import type { CSSProperties } from 'react';
import { normalizeMediaTextAlignment } from '@/lib/media/shared';

export function resolveMapEmbeddedContainerStyle(input: {
  displaySize: number;
  blockAlignment?: string;
  applyDisplaySize: boolean;
  isMobileViewport: boolean;
}): CSSProperties {
  const shouldApplyWidth = input.applyDisplaySize && !input.isMobileViewport;
  const style: CSSProperties = {
    width: shouldApplyWidth ? `${input.displaySize}%` : '100%',
    maxWidth: '100%',
  };

  if (!shouldApplyWidth || input.displaySize >= 100) {
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
