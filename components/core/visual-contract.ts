/** Shared forbidden presentation properties for typed and runtime boundaries. */
export const visualEscapeProperties = [
  'style',
  'styles',
  'className',
  'classNames',
  'vars',
  'unstyled',
  'component',
  'renderRoot',
  'color',
  'c',
  'bg',
  'radius',
  'shadow',
  'variant',
  'p',
  'px',
  'py',
  'pt',
  'pb',
  'pl',
  'pr',
  'ps',
  'pe',
  'm',
  'mx',
  'my',
  'mt',
  'mb',
  'ml',
  'mr',
  'ms',
  'me',
  'w',
  'h',
  'miw',
  'mih',
  'maw',
  'mah',
  'fz',
  'fw',
  'ff',
  'lh',
  'ta',
  'td',
  'tt',
  'opacity',
  'bd',
  'bdrs',
] as const;
/** A shared negative contract also rejects visual overrides hidden in typed prop spreads. */
export interface ClosedVisualProps {
  style?: never;
  styles?: never;
  className?: never;
  classNames?: never;
  vars?: never;
  unstyled?: never;
  component?: never;
  renderRoot?: never;
  color?: never;
  c?: never;
  bg?: never;
  radius?: never;
  shadow?: never;
  variant?: never;
  p?: never;
  px?: never;
  py?: never;
  pt?: never;
  pb?: never;
  pl?: never;
  pr?: never;
  ps?: never;
  pe?: never;
  m?: never;
  mx?: never;
  my?: never;
  mt?: never;
  mb?: never;
  ml?: never;
  mr?: never;
  ms?: never;
  me?: never;
  w?: never;
  h?: never;
  miw?: never;
  mih?: never;
  maw?: never;
  mah?: never;
  fz?: never;
  fw?: never;
  ff?: never;
  lh?: never;
  ta?: never;
  td?: never;
  tt?: never;
  opacity?: never;
  bd?: never;
  bdrs?: never;
  [key: `data-geul-${string}`]: undefined;
  [key: `data-core-${string}`]: undefined;
}

/** State attributes rendered by Core; callers' copies never reach a Core root (presentation or control). */
export const coreOwnedStateAttributes = [
  'data-active',
  'data-selected',
  'data-disabled',
  'data-pending',
  'data-hovered',
  'data-pressed',
  'data-focus-visible',
  'data-focused',
  'data-tone',
  'data-emphasis',
  'data-control-kind',
  'data-control-size',
  'data-contrast',
  'data-label-wrap',
] as const;
const coreOwnedStateAttributeSet: ReadonlySet<string> = new Set(coreOwnedStateAttributes);
/** Reserved namespaces plus Core-owned state; shared by every runtime attribute filter. */
export function isCoreOwnedAttribute(key: string) {
  return key.startsWith('data-geul-') || key.startsWith('data-core-') || coreOwnedStateAttributeSet.has(key);
}
