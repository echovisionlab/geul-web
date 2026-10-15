import type { CSSProperties } from 'react';
import { primitiveTokens } from '@/components/core/design-tokens';

export const DEFAULT_SITE_BRAND_COLOR = primitiveTokens.colors.brand;

export type SiteBrandStyle = CSSProperties & {
  '--geul-brand-color': string;
};

export function normalizeSiteBrandColor(value: string | null | undefined): string {
  const candidate = value?.trim();
  return candidate && /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : DEFAULT_SITE_BRAND_COLOR;
}

export function siteBrandStyle(value: string | null | undefined): SiteBrandStyle {
  return { '--geul-brand-color': normalizeSiteBrandColor(value) };
}
