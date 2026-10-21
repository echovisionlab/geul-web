import type { CSSProperties } from 'react';

export function getExternalContainerStyle(displaySize: string, textAlignment: string): CSSProperties {
  const widthPercent = Math.max(10, Math.min(100, parseInt(displaySize, 10) || 100));
  if (widthPercent >= 100) {
    return {};
  }

  const style: CSSProperties = { width: `${widthPercent}%` };
  if (textAlignment === 'center') {
    style.margin = '0 auto';
  } else if (textAlignment === 'right') {
    style.marginLeft = 'auto';
  }

  return style;
}
