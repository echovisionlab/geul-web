import { primitiveTokens } from './design-tokens';

type LayerName = keyof typeof primitiveTokens.layer;

/** Numeric adapter for React Aria portals and inline styles; values have one token authority
 * (`primitiveTokens.layer`, also generated as `--geul-layer-*`). */
export const overlayLayers = Object.freeze(
  Object.fromEntries(Object.entries(primitiveTokens.layer).map(([name, value]) => [name, Number(value)])),
) as Readonly<Record<LayerName, number>>;
