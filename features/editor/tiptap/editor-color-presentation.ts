export const SEMANTIC_EDITOR_COLOR_VALUES = new Set([
  'default',
  'gray',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
]);

const SAFE_HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Semantic names stay theme-aware; only strict legacy hex values receive an inline fallback. */
export function inlineEditorColorStyle(type: 'textColor' | 'backgroundColor', value: unknown): string | undefined {
  const color = String(value ?? '').trim();
  if (!color || SEMANTIC_EDITOR_COLOR_VALUES.has(color) || !SAFE_HEX_COLOR.test(color)) {
    return undefined;
  }
  return `${type === 'textColor' ? 'color' : 'background-color'}:${color}`;
}
