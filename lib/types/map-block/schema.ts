import * as z from '@/lib/zod-mini';
import { MAP_MAX_ZOOM_LIMIT, MAP_MIN_ZOOM_LIMIT } from '@/lib/types/map/model';
import { LEGACY_MAP_BLOCK_WIRE_FIELDS, MAP_BLOCK_FIELDS } from './fields';
import type { DurablePropSchema } from '@/lib/types/editor/schema';

// === Coordinate Validation ===

/**
 * Validate latitude string: empty allowed, otherwise must be number in range [-90, 90]
 */
const latitudeString = z._default(
  z.string().check(
    z.refine(
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
    ),
  ),
  '',
);

/**
 * Validate longitude string: empty allowed, otherwise must be number in range [-180, 180]
 */
const longitudeString = z._default(
  z.string().check(
    z.refine(
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
    ),
  ),
  '',
);

/**
 * Validate zoom string: must be a number in range [1, 20]
 */
const zoomString = z._default(
  z.string().check(
    z.refine(
      (val) => {
        const num = parseFloat(val);
        if (isNaN(num)) {
          return false;
        }
        return num >= MAP_MIN_ZOOM_LIMIT && num <= MAP_MAX_ZOOM_LIMIT;
      },
      { message: `Zoom must be a number between ${MAP_MIN_ZOOM_LIMIT} and ${MAP_MAX_ZOOM_LIMIT}` },
    ),
  ),
  '15',
);

const zoomBoundString = z.string().check(
  z.refine(
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
  ),
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
export const mapBlockSchema = z.object({
  // Place references
  mapPlaceIds: z._default(z.string(), ''),
  // Display
  aspectRatio: z._default(z.enum(['16:9', '4:3', '1:1']), '16:9'),
  previewWidth: z._default(z.string(), '100'),
  zoom: zoomString,
  minZoom: z._default(zoomBoundString, String(MAP_MIN_ZOOM_LIMIT)),
  maxZoom: z._default(zoomBoundString, String(MAP_MAX_ZOOM_LIMIT)),
  // Durable resize-shell fields
  url: z._default(z.string(), 'map'),
  showPreview: z._default(z.enum(['true', 'false']), 'true'),
  // Interaction
  draggable: z._default(z.enum(['true', 'false']), 'true'),
  zoomable: z._default(z.enum(['true', 'false']), 'true'),
  rotatable: z._default(z.enum(['true', 'false']), 'false'),
  tiltable: z._default(z.enum(['true', 'false']), 'false'),
  pinClickable: z._default(z.enum(['true', 'false']), 'true'),
  // Center
  centerLat: latitudeString,
  centerLng: longitudeString,
  // 3D
  pitch: z._default(z.string(), '0'),
  bearing: z._default(z.string(), '0'),
  show3DBuildings: z._default(z.enum(['true', 'false']), 'false'),
  autoRotate: z._default(z.enum(['true', 'false']), 'false'),
  autoRotateSpeed: z._default(z.string(), '1'),
  showDirections: z._default(z.enum(['true', 'false']), 'true'),
  // Style
  variant: z._default(z.enum(['default']), 'default'),
  themeId: z._default(z.string(), ''),
  preferredScheme: z._default(z.enum(['auto', 'light', 'dark']), 'auto'),
  areaLabelsMode: z._default(z.enum(['inherit', 'show', 'hide']), 'inherit'),
  poiLabelsMode: z._default(z.enum(['inherit', 'show', 'hide']), 'inherit'),
  // Caption
  caption: z._default(z.string(), ''),
});

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
