import type { AriaAttributes, HTMLAttributes } from 'react';
import { primitiveTokens } from '../design-tokens';
import type { ClosedVisualProps } from '../visual-contract';

/** External relationships are available to compositions; internal control gaps
 * stay with their Core owners. Foundation names remain available for insets. */
export type Space = 'none' | keyof typeof primitiveTokens.spacing | 'action-group' | 'section';
export type LayoutBreakpoint = keyof typeof primitiveTokens.breakpoints;
export type LayoutPoint = 'base' | LayoutBreakpoint;
export type Responsive<T> = T | Partial<Record<LayoutPoint, T>>;
export type LayoutAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type LayoutColumnCount = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
/** Minimum column width of a fluid grid (`sm` 9rem, `md` 14rem, `lg` 20rem): it fits as many columns as the width allows. */
export const LAYOUT_MIN_COLUMN_WIDTHS = ['sm', 'md', 'lg'] as const;
export type LayoutMinColumnWidth = (typeof LAYOUT_MIN_COLUMN_WIDTHS)[number];
export const isMinColumnWidth = (value: unknown): value is LayoutMinColumnWidth =>
  LAYOUT_MIN_COLUMN_WIDTHS.includes(value as LayoutMinColumnWidth);
export type LayoutColumnSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 'full';
export type LayoutColumnOffset = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type LayoutElement =
  | 'div'
  | 'span'
  | 'section'
  | 'article'
  | 'aside'
  | 'main'
  | 'header'
  | 'footer'
  | 'nav'
  | 'ul'
  | 'ol'
  | 'li'
  | 'dl'
  | 'dt'
  | 'dd'
  | 'figure'
  | 'figcaption';
export type LayoutContainerSize = 'form' | 'reading' | 'compact' | 'standard' | 'wide' | 'full';

const nativeKeys = ['id', 'title', 'role', 'lang', 'dir', 'hidden', 'tabIndex'] as const;
const eventKeys = [
  'onFocus',
  'onBlur',
  'onKeyDown',
  'onKeyUp',
  'onClick',
  'onDoubleClick',
  'onMouseDown',
  'onMouseUp',
  'onContextMenu',
  'onMouseEnter',
  'onMouseLeave',
  'onPointerDown',
  'onPointerMove',
  'onPointerUp',
  'onPointerEnter',
  'onPointerLeave',
  'onPointerCancel',
  'onScroll',
  'onDragOverCapture',
  'onDropCapture',
  'onDragEnter',
  'onDragLeave',
  'onDragOver',
  'onDrop',
] as const;
const safeKeys = new Set<string>([...nativeKeys, ...eventKeys]);
const allowedElements = new Set<string>([
  'div',
  'span',
  'section',
  'article',
  'aside',
  'main',
  'header',
  'footer',
  'nav',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'figure',
  'figcaption',
]);
export const layoutPoints: readonly LayoutPoint[] = [
  'base',
  ...(Object.keys(primitiveTokens.breakpoints) as LayoutBreakpoint[]),
];

/** Explicit never keys reject identified escapes even when passed through a prop spread. */
export interface LayoutForbiddenPresentation extends ClosedVisualProps {
  style?: never;
  styles?: never;
  className?: never;
  classNames?: never;
  vars?: never;
  unstyled?: never;
  color?: never;
  radius?: never;
  variant?: never;
  p?: never;
  px?: never;
  py?: never;
  m?: never;
  w?: never;
  h?: never;
  fw?: never;
  fz?: never;
  bg?: never;
  opacity?: never;
  component?: never;
  dangerouslySetInnerHTML?: never;
  'data-geul-layout'?: never;
  'data-geul-layout-align'?: never;
  'data-geul-layout-justify'?: never;
  'data-geul-layout-wrap'?: never;
  'data-geul-layout-grow'?: never;
  'data-geul-layout-axis'?: never;
  'data-geul-layout-flexible'?: never;
  'data-geul-layout-size'?: never;
}

export type LayoutNativeProps = Pick<
  HTMLAttributes<HTMLElement>,
  (typeof nativeKeys)[number] | (typeof eventKeys)[number]
> &
  AriaAttributes &
  LayoutForbiddenPresentation & {
    [key: `data-${string}`]: string | number | boolean | undefined;
    [key: `data-geul-${string}`]: undefined;
  };

/** Runtime projection protects JS/cast/spread callers too; presentation never reaches the DOM. */
export function projectLayoutAttributes(props: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(props).filter(
      ([key, value]) =>
        (safeKeys.has(key) && (!key.startsWith('on') || value === undefined || typeof value === 'function')) ||
        (/^(?:aria|data)-[\w-]+$/.test(key) &&
          !key.startsWith('data-geul-') &&
          !key.startsWith('data-core-') &&
          (value === undefined ||
            typeof value === 'string' ||
            typeof value === 'boolean' ||
            typeof value === 'number')),
    ),
  );
}

export function resolveElement(value: LayoutElement | undefined): LayoutElement {
  if (value !== undefined && !allowedElements.has(value)) {
    throw new RangeError('Core Layout as must be a supported structural element');
  }
  return value ?? 'div';
}

export function resolveResponsive<T>(
  value: Responsive<T> | undefined,
  fallback: T,
  valid: (candidate: unknown) => candidate is T,
  name: string,
): Record<LayoutPoint, T> {
  const source: Partial<Record<LayoutPoint, T>> =
    value !== null && typeof value === 'object'
      ? (value as Partial<Record<LayoutPoint, T>>)
      : { base: value ?? fallback };
  for (const [key, candidate] of Object.entries(source)) {
    if (!layoutPoints.includes(key as LayoutPoint) || !valid(candidate)) {
      throw new RangeError(`Core Layout ${name} must use supported named values and breakpoints`);
    }
  }
  let current = fallback;
  return Object.fromEntries(
    layoutPoints.map((point) => {
      current = source[point] ?? current;
      return [point, current];
    }),
  ) as Record<LayoutPoint, T>;
}

export const isSpace = (value: unknown): value is Space =>
  value === 'none' ||
  value === 'action-group' ||
  value === 'section' ||
  (typeof value === 'string' && Object.hasOwn(primitiveTokens.spacing, value));
export const isColumnCount = (value: unknown): value is LayoutColumnCount =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 12;
export const isColumnSpan = (value: unknown): value is LayoutColumnSpan =>
  value === 'full' || (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 12);
export const isColumnOffset = (value: unknown): value is LayoutColumnOffset =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 11;
const spacingVariables: Record<Exclude<Space, 'none'>, string> = {
  xxs: 'var(--geul-spacing-xxs)',
  xs: 'var(--geul-spacing-xs)',
  sm: 'var(--geul-spacing-sm)',
  md: 'var(--geul-spacing-md)',
  lg: 'var(--geul-spacing-lg)',
  xl: 'var(--geul-spacing-xl)',
  'action-group': 'var(--geul-spacing-role-action-group)',
  section: 'var(--geul-spacing-role-section)',
};
export const spaceValue = (space: Space) => (space === 'none' ? '0' : spacingVariables[space]);
export function responsiveVariables<T>(
  name: string,
  values: Record<LayoutPoint, T>,
  format: (value: T) => string = String,
) {
  return Object.fromEntries(layoutPoints.map((point) => [`--_layout-${name}-${point}`, format(values[point])]));
}
