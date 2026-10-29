import type { CSSProperties } from 'react';
import { primitiveTokens } from '@/components/core/design-tokens';

export const DEFAULT_SITE_BRAND_COLOR = primitiveTokens.colors.brand;

export type SiteBrandStyle = CSSProperties & {
  '--geul-brand-color': string;
  '--geul-brand-ink': string;
};

const BRAND_INK_LIGHT = '#ffffff';
const BRAND_INK_DARK = '#1b1b19';

export function normalizeSiteBrandColor(value: string | null | undefined): string {
  const candidate = value?.trim();
  return candidate && /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : DEFAULT_SITE_BRAND_COLOR;
}

function relativeLuminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrastRatio(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Picks the text color with the higher WCAG contrast against the brand fill. */
export function siteBrandInk(color: string): string {
  const fill = relativeLuminance(color);
  return contrastRatio(fill, relativeLuminance(BRAND_INK_LIGHT)) >= contrastRatio(fill, relativeLuminance(BRAND_INK_DARK))
    ? BRAND_INK_LIGHT
    : BRAND_INK_DARK;
}

export function siteBrandStyle(value: string | null | undefined): SiteBrandStyle {
  const color = normalizeSiteBrandColor(value);
  return { '--geul-brand-color': color, '--geul-brand-ink': siteBrandInk(color) };
}
