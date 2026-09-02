/**
 * Callout field options for display
 */
export type CalloutField = 'name' | 'address' | 'coordinates' | 'street' | 'city' | 'region' | 'country' | 'postalCode';

/**
 * ThemeSettings - Shared settings that apply to both light/dark variants
 * (stored in map_theme table)
 */
export interface ThemeSettings {
  // Callout layout (relative to screen size)
  calloutScale: number; // 전체 스케일 (화면 크기 기반)
  calloutOffsetX: number; // 박스 수평 오프셋
  calloutOffsetY: number; // 박스 수직 오프셋

  // Callout fields (displayed in order)
  calloutFields: CalloutField[];

  // Base map labels
  showAreaLabels: boolean;
  showPoiLabels: boolean;

  // Attribution
  attributionFontSize: number; // px (9-14)
}

/**
 * ThemeVariant - Colors for a specific scheme (light or dark)
 * All colors support RGBA format (opacity is embedded in color)
 * (stored as light_* or dark_* fields on map_theme)
 */
export interface ThemeVariant {
  /** Stable transport identifier; variants are not separate DB rows. */
  id: string;
  scheme: 'light' | 'dark';

  // Base colors (RGBA supported)
  backgroundColor: string;
  waterColor: string;
  landColor: string;

  // Road (RGBA supported)
  roadColor: string;

  // Building fill (RGBA supported)
  buildingFillColor: string;

  // Building stroke (RGBA supported)
  buildingStrokeEnabled: boolean;
  buildingStrokeColor: string;

  // Callout (RGBA supported)
  calloutLineColor: string;
  calloutHoverLineColor: string;
  calloutTextColor: string;
  calloutHoverTextColor: string;
  calloutDescriptionColor: string;
  calloutHoverDescriptionColor: string;
  calloutBackgroundColor: string;
  calloutHoverBackgroundColor: string;

  // Attribution (RGBA supported)
  attributionColor: string;

  // Base map labels (RGBA supported)
  labelTextColor: string;

  // Cluster bubble (RGBA supported)
  clusterColor: string;
  clusterHoverColor: string;
  clusterTextColor: string;
  clusterTextHoverColor: string;
}

/**
 * MapTheme - Complete theme aggregate (map_theme row with light/dark fields)
 */
export interface MapTheme {
  id: string;
  name: string;
  settings: ThemeSettings;
  lightVariant: ThemeVariant;
  darkVariant: ThemeVariant;
  revision?: bigint;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MapThemeList {
  themes: MapTheme[];
  defaultMapThemeId: string;
}

export interface ResolvedPublicMapTheme {
  requestedThemeId: string;
  theme: MapTheme;
}

/**
 * ResolvedThemeConfig - Combined variant + settings for rendering
 */
export interface ResolvedThemeConfig extends Omit<ThemeVariant, 'id' | 'scheme'>, ThemeSettings {}
