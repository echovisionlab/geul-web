import type { CSSProperties } from 'react';

export type PageSectionMaxWidth = 'full' | 'container' | 'narrow';

export interface PageSectionStyleSettings {
  backgroundColor?: string;
  paddingTop?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  maxWidth?: PageSectionMaxWidth;
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
  const bounded = settings?.maxWidth === 'container' || settings?.maxWidth === 'narrow';

  return {
    backgroundColor: settings?.backgroundColor || undefined,
    paddingTop: settings?.paddingTop ? `${settings.paddingTop}px` : undefined,
    paddingBottom: settings?.paddingBottom ? `${settings.paddingBottom}px` : undefined,
    paddingLeft: settings?.paddingLeft ? `${settings.paddingLeft}px` : undefined,
    paddingRight: settings?.paddingRight ? `${settings.paddingRight}px` : undefined,
    maxWidth: maxWidthValue,
    marginLeft: bounded ? 'auto' : undefined,
    marginRight: bounded ? 'auto' : undefined,
  };
}
