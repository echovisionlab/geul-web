/**
 * Display size is one 10–100 share that a resizable block stores. It caps the
 * block's inline size at that share of its content column. A block with an
 * aspect ratio also caps its height at the same share of 80svh, so a tall image
 * fits the screen instead of growing with the column.
 */
export const DISPLAY_SIZE_MIN = 10;
export const DISPLAY_SIZE_MAX = 100;
export const DISPLAY_SIZE_DEFAULT = 100;

export const DISPLAY_SIZE_PRESETS = [
  { id: 'xs', value: 25 },
  { id: 's', value: 40 },
  { id: 'm', value: 60 },
  { id: 'l', value: 80 },
  { id: 'xl', value: 100 },
] as const;

export type DisplaySizePresetId = (typeof DISPLAY_SIZE_PRESETS)[number]['id'];

/** A drag that ends this close to a preset lands on it. */
const PRESET_SNAP_DISTANCE = 2;

export function normalizeDisplaySize(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DISPLAY_SIZE_DEFAULT;
  }
  return Math.max(DISPLAY_SIZE_MIN, Math.min(DISPLAY_SIZE_MAX, Math.round(parsed)));
}

export function snapDisplaySize(value: number): number {
  const size = normalizeDisplaySize(value);
  const preset = DISPLAY_SIZE_PRESETS.find((candidate) => Math.abs(candidate.value - size) <= PRESET_SNAP_DISTANCE);
  return preset?.value ?? size;
}

export function displaySizePreset(value: unknown): DisplaySizePresetId | undefined {
  const size = normalizeDisplaySize(value);
  return DISPLAY_SIZE_PRESETS.find((preset) => preset.value === size)?.id;
}

/**
 * CSS inline size of a block at this display size, or undefined when it simply
 * fills its column. `aspectRatio` is width / height; omit it for blocks whose
 * height does not follow their width.
 */
export function displaySizeInlineSize(value: unknown, aspectRatio?: number): string | undefined {
  const size = normalizeDisplaySize(value);
  const share = `${size}%`;
  if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return size >= DISPLAY_SIZE_MAX ? undefined : share;
  }
  // size% of 80svh is size × 0.8svh.
  return `min(${share}, calc(${size * 0.8}svh * ${Number(aspectRatio.toFixed(4))}))`;
}

/** True when the block cannot fill its column, so it should not break out of it. */
export function displaySizeIsPortrait(aspectRatio?: number): boolean {
  return Boolean(aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0 && aspectRatio < 1);
}

/** Width / height of an authored "w:h" aspect ratio, or undefined for "auto" and unknown values. */
export function parseAspectRatio(label: string | undefined | null): number | undefined {
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(label ?? '').trim());
  const width = Number(match?.[1]);
  const height = Number(match?.[2]);
  return width > 0 && height > 0 ? width / height : undefined;
}
