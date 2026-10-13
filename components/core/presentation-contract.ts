import type { AriaAttributes, DOMAttributes, ReactNode } from 'react';
import { isCoreOwnedAttribute, type ClosedVisualProps } from './visual-contract';

/** Public presentation contracts admit meaning and native interaction, never styling overrides. */
export interface PresentationProps
  extends AriaAttributes, ClosedVisualProps, Omit<DOMAttributes<HTMLElement>, 'children' | 'dangerouslySetInnerHTML'> {
  children?: ReactNode;
  id?: string;
  title?: string;
  role?: string;
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  hidden?: boolean;
  tabIndex?: number;
  suppressHydrationWarning?: boolean;
  [key: `data-${string}`]: string | number | boolean | undefined;
  [key: `data-geul-${string}`]: undefined;
  [key: `data-core-${string}`]: undefined;
}

const nativeKeys = new Set(['id', 'title', 'role', 'lang', 'dir', 'hidden', 'tabIndex', 'suppressHydrationWarning']);
export function presentationAttributes(props: object) {
  return Object.fromEntries(
    Object.entries(props).filter(
      ([key]) =>
        nativeKeys.has(key) ||
        /^on[A-Z]/.test(key) ||
        key.startsWith('aria-') ||
        (key.startsWith('data-') && !isCoreOwnedAttribute(key)),
    ),
  );
}
