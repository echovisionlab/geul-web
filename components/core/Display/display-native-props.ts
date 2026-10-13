import type { AriaAttributes, AriaRole, DOMAttributes } from 'react';

/** Shared by client Display parts and the server-renderable Pagination; no client directive. */
export interface DisplayNativeProps
  extends AriaAttributes, Omit<DOMAttributes<HTMLElement>, 'children' | 'dangerouslySetInnerHTML'> {
  id?: string;
  title?: string;
  role?: AriaRole;
  tabIndex?: number;
  style?: never;
  styles?: never;
  className?: never;
  classNames?: never;
  vars?: never;
  unstyled?: never;
  color?: never;
  c?: never;
  radius?: never;
  [key: `data-${string}`]: string | number | boolean | undefined;
}
export function nativeProps(props: DisplayNativeProps) {
  return Object.fromEntries(
    Object.entries(props).filter(
      ([key]) =>
        ['id', 'title', 'role', 'tabIndex'].includes(key) ||
        key.startsWith('aria-') ||
        (key.startsWith('data-') && !key.startsWith('data-geul-') && !key.startsWith('data-core-')) ||
        /^on[A-Z]/.test(key),
    ),
  );
}
export type DisplaySize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
