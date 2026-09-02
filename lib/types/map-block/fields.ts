/**
 * Map Block field definitions (Single Source of Truth)
 *
 * All values are stored as strings for Yjs serialization compatibility.
 * Both page and post editor schemas are generated from this.
 *
 * type: 'string' | 'enum'
 * default: Default value (always string)
 * values: Allowed values for enum type
 */

export type FieldDef =
  { type: 'string'; default: string } | { type: 'enum'; default: string; values: readonly string[] };

export const MAP_BLOCK_FIELDS = {
  // Place references
  /** MapPlace IDs (comma-separated) */
  mapPlaceIds: { type: 'string', default: '' },

  // Display
  /** Map aspect ratio */
  aspectRatio: { type: 'enum', default: '16:9', values: ['16:9', '4:3', '1:1'] },
  /** Map preview width as percentage (1-100) */
  previewWidth: { type: 'string', default: '100' },
  /** Map zoom level (always explicit) */
  zoom: { type: 'string', default: '15' },
  /** Minimum allowed zoom level */
  minZoom: { type: 'string', default: '-2' },
  /** Maximum allowed zoom level */
  maxZoom: { type: 'string', default: '22' },

  // Durable resize-shell fields
  /** Dummy URL for the resize shell (always 'map') */
  url: { type: 'string', default: 'map' },
  /** Show preview for resize wrapper (always true) */
  showPreview: { type: 'enum', default: 'true', values: ['true', 'false'] },

  // Interaction
  /** Allow map dragging */
  draggable: { type: 'enum', default: 'true', values: ['true', 'false'] },
  /** Allow map zooming */
  zoomable: { type: 'enum', default: 'true', values: ['true', 'false'] },
  /** Allow map rotation (bearing) */
  rotatable: { type: 'enum', default: 'false', values: ['true', 'false'] },
  /** Allow map tilting (pitch) */
  tiltable: { type: 'enum', default: 'false', values: ['true', 'false'] },
  /** Allow pin click to show popup */
  pinClickable: { type: 'enum', default: 'true', values: ['true', 'false'] },

  // Center
  /** Center latitude (always explicit) */
  centerLat: { type: 'string', default: '' },
  /** Center longitude (always explicit) */
  centerLng: { type: 'string', default: '' },

  // 3D
  /** 3D tilt angle (0 = 2D) */
  pitch: { type: 'string', default: '0' },
  /** Map rotation in degrees */
  bearing: { type: 'string', default: '0' },
  /** Show 3D buildings */
  show3DBuildings: { type: 'enum', default: 'false', values: ['true', 'false'] },
  /** Enable auto-rotation (only active when pitch > 0) */
  autoRotate: { type: 'enum', default: 'false', values: ['true', 'false'] },
  /** Auto-rotation speed in degrees per second */
  autoRotateSpeed: { type: 'string', default: '1' },
  /** Show directions links on callout click */
  showDirections: { type: 'enum', default: 'true', values: ['true', 'false'] },

  // Style
  /** View variant */
  variant: { type: 'enum', default: 'default', values: ['default'] },
  /** MapTheme ID reference */
  themeId: { type: 'string', default: '' },
  /** Preferred color scheme when theme supports both light/dark */
  preferredScheme: { type: 'enum', default: 'auto', values: ['auto', 'light', 'dark'] },
  /** Override area label visibility for this map instance */
  areaLabelsMode: { type: 'enum', default: 'inherit', values: ['inherit', 'show', 'hide'] },
  /** Override POI label visibility for this map instance */
  poiLabelsMode: { type: 'enum', default: 'inherit', values: ['inherit', 'show', 'hide'] },

  // Caption
  /** Optional caption text displayed below the map */
  caption: { type: 'string', default: '' },
} as const satisfies Record<string, FieldDef>;

/**
 * Read-only wire compatibility for map documents written before
 * `mapPlaceIds` and explicit center coordinates became canonical.
 *
 * These fields are intentionally excluded from `MAP_BLOCK_FIELDS`: new
 * authoring state must not treat them as supported durable map props.
 */
export const LEGACY_MAP_BLOCK_WIRE_FIELDS = {
  mapPlaceId: { type: 'string', default: '' },
  location: { type: 'string', default: '' },
} as const satisfies Record<string, FieldDef>;
