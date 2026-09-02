import { z } from 'zod';
import { MAP_MAX_ZOOM_LIMIT, MAP_MIN_ZOOM_LIMIT } from '@/lib/types/map/model';
import { LEGACY_MAP_BLOCK_WIRE_FIELDS, MAP_BLOCK_FIELDS } from './fields';
import type { DurablePropSchema } from '@/lib/types/editor/schema';

// === Coordinate Validation ===

/**
 * Validate latitude string: empty allowed, otherwise must be number in range [-90, 90]
 */
const latitudeString = z
  .string()
  .refine(
    (val) => {
      if (val === '') {
        return true;
      }
      const num = parseFloat(val);
      if (isNaN(num)) {
        return false;
      }
      return num >= -90 && num <= 90;
    },
    { message: 'Latitude must be a number between -90 and 90' },
  )
  .default('');

/**
 * Validate longitude string: empty allowed, otherwise must be number in range [-180, 180]
 */
const longitudeString = z
  .string()
  .refine(
    (val) => {
      if (val === '') {
        return true;
      }
      const num = parseFloat(val);
      if (isNaN(num)) {
        return false;
      }
      return num >= -180 && num <= 180;
    },
    { message: 'Longitude must be a number between -180 and 180' },
  )
  .default('');

/**
 * Validate zoom string: must be a number in range [1, 20]
 */
const zoomString = z
  .string()
  .refine(
    (val) => {
      const num = parseFloat(val);
      if (isNaN(num)) {
        return false;
      }
      return num >= MAP_MIN_ZOOM_LIMIT && num <= MAP_MAX_ZOOM_LIMIT;
    },
    { message: `Zoom must be a number between ${MAP_MIN_ZOOM_LIMIT} and ${MAP_MAX_ZOOM_LIMIT}` },
  )
  .default('15');

const zoomBoundString = z.string().refine(
  (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) {
      return false;
    }
    return num >= MAP_MIN_ZOOM_LIMIT && num <= MAP_MAX_ZOOM_LIMIT;
  },
  {
    message: `Zoom bound must be a number between ${MAP_MIN_ZOOM_LIMIT} and ${MAP_MAX_ZOOM_LIMIT}`,
  },
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function coordinateString(value: unknown, minimum: number, maximum: number): string | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') {
    return null;
  }
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum ? String(coordinate) : null;
}

function legacyLocationCoordinates(value: unknown): { centerLat: string; centerLng: string } | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  try {
    const location: unknown = JSON.parse(value);
    if (!isRecord(location)) {
      return null;
    }
    const centerLat = coordinateString(location.lat, -90, 90);
    const centerLng = coordinateString(location.lng, -180, 180);
    return centerLat && centerLng ? { centerLat, centerLng } : null;
  } catch {
    return null;
  }
}

/**
 * Converts legacy map wire attributes into the current prop shape without
 * mutating the source document. Canonical values always win when present.
 */
export function normalizeMapBlockPropsInput(data: unknown): Record<string, unknown> {
  if (!isRecord(data)) {
    return {};
  }

  const normalized = { ...data };
  if (!nonEmptyString(normalized.mapPlaceIds)) {
    const legacyMapPlaceId = nonEmptyString(normalized.mapPlaceId);
    if (legacyMapPlaceId) {
      normalized.mapPlaceIds = legacyMapPlaceId;
    }
  }

  const centerLat = coordinateString(normalized.centerLat, -90, 90);
  const centerLng = coordinateString(normalized.centerLng, -180, 180);
  if (!centerLat || !centerLng) {
    const legacyCenter = legacyLocationCoordinates(normalized.location);
    if (legacyCenter) {
      normalized.centerLat = legacyCenter.centerLat;
      normalized.centerLng = legacyCenter.centerLng;
    }
  }

  delete normalized.mapPlaceId;
  delete normalized.location;
  return normalized;
}

/**
 * Zod schema for Map Block props - explicitly typed for proper inference
 */
export const mapBlockSchema = z
  .object({
    // Place references
    mapPlaceIds: z.string().default(''),
    // Display
    aspectRatio: z.enum(['16:9', '4:3', '1:1']).default('16:9'),
    previewWidth: z.string().default('100'),
    zoom: zoomString,
    minZoom: zoomBoundString.default(String(MAP_MIN_ZOOM_LIMIT)),
    maxZoom: zoomBoundString.default(String(MAP_MAX_ZOOM_LIMIT)),
    // Durable resize-shell fields
    url: z.string().default('map'),
    showPreview: z.enum(['true', 'false']).default('true'),
    // Interaction
    draggable: z.enum(['true', 'false']).default('true'),
    zoomable: z.enum(['true', 'false']).default('true'),
    rotatable: z.enum(['true', 'false']).default('false'),
    tiltable: z.enum(['true', 'false']).default('false'),
    pinClickable: z.enum(['true', 'false']).default('true'),
    // Center
    centerLat: latitudeString,
    centerLng: longitudeString,
    // 3D
    pitch: z.string().default('0'),
    bearing: z.string().default('0'),
    show3DBuildings: z.enum(['true', 'false']).default('false'),
    autoRotate: z.enum(['true', 'false']).default('false'),
    autoRotateSpeed: z.string().default('1'),
    showDirections: z.enum(['true', 'false']).default('true'),
    // Style
    variant: z.enum(['default']).default('default'),
    themeId: z.string().default(''),
    preferredScheme: z.enum(['auto', 'light', 'dark']).default('auto'),
    areaLabelsMode: z.enum(['inherit', 'show', 'hide']).default('inherit'),
    poiLabelsMode: z.enum(['inherit', 'show', 'hide']).default('inherit'),
    // Caption
    caption: z.string().default(''),
  })
  .strip();

export type MapBlockProps = z.infer<typeof mapBlockSchema>;

/**
 * Parse unknown data to MapBlockProps with defaults
 */
export function parseMapBlockProps(data: unknown): MapBlockProps {
  return mapBlockSchema.parse(normalizeMapBlockPropsInput(data));
}

// === Durable ProseMirror/Tiptap attribute schema ===

type MapBlockPropSchema = {
  [K in keyof typeof MAP_BLOCK_FIELDS]: (typeof MAP_BLOCK_FIELDS)[K] extends {
    values: readonly string[];
  }
    ? { default: string; values: readonly string[] }
    : { default: string };
};

function buildMapBlockPropSchema(): MapBlockPropSchema & {
  textAlignment: { default: 'left'; values: readonly ['left', 'center', 'right'] };
} {
  const result: Record<string, { default: string; values?: readonly string[] }> = {};
  for (const [key, def] of Object.entries(MAP_BLOCK_FIELDS)) {
    if (def.type === 'string') {
      result[key] = { default: def.default };
    } else {
      result[key] = { default: def.default, values: def.values };
    }
  }
  // Alignment is persisted on every map block.
  result.textAlignment = { default: 'left', values: ['left', 'center', 'right'] as const };
  return result as MapBlockPropSchema & {
    textAlignment: { default: 'left'; values: readonly ['left', 'center', 'right'] };
  };
}

/**
 * Durable map node attributes used by the post and page Tiptap editors.
 */
export const mapBlockPropSchema = buildMapBlockPropSchema() satisfies DurablePropSchema;

/**
 * ProseMirror/Yjs accepts the released legacy attributes long enough to read
 * existing documents. Application code must normalize through
 * `normalizeMapBlockPropsInput` and write only `mapBlockPropSchema` fields.
 */
export const mapBlockWirePropSchema = {
  ...mapBlockPropSchema,
  mapPlaceId: { default: LEGACY_MAP_BLOCK_WIRE_FIELDS.mapPlaceId.default },
  location: { default: LEGACY_MAP_BLOCK_WIRE_FIELDS.location.default },
} satisfies DurablePropSchema;
