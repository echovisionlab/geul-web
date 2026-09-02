import type { CSSProperties } from 'react';

export interface PageSectionStyleSettings {
  backgroundColor?: string;
  paddingTop?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  maxWidth?: 'full' | 'container' | 'narrow';
}

export function getPageSectionStyle(settings?: PageSectionStyleSettings | null): CSSProperties {
  const maxWidthValue =
    settings?.maxWidth === 'full' || !settings?.maxWidth
      ? '100%'
      : settings.maxWidth === 'container'
        ? '1200px'
        : settings.maxWidth === 'narrow'
          ? '800px'
          : '100%';

  return {
    backgroundColor: settings?.backgroundColor || undefined,
    paddingTop: settings?.paddingTop ? `${settings.paddingTop}px` : undefined,
    paddingBottom: settings?.paddingBottom ? `${settings.paddingBottom}px` : undefined,
    paddingLeft: settings?.paddingLeft ? `${settings.paddingLeft}px` : undefined,
    paddingRight: settings?.paddingRight ? `${settings.paddingRight}px` : undefined,
    maxWidth: maxWidthValue,
    marginLeft: settings?.maxWidth && settings.maxWidth !== 'full' ? 'auto' : undefined,
    marginRight: settings?.maxWidth && settings.maxWidth !== 'full' ? 'auto' : undefined,
  };
}
