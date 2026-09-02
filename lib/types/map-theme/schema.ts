import { z } from 'zod';
import {
  MapThemeDocumentMetaSchema,
  MapThemeDocumentSettingsSchema,
  MapThemeDocumentVariantSchema,
} from '@echovisionlab/geul-common/collaboration/map-theme';
import type { ResolvedThemeConfig, ThemeSettings, ThemeVariant } from './model';

/**
 * Default theme settings
 */
export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  calloutScale: 1,
  calloutOffsetX: 0,
  calloutOffsetY: 0,
  calloutFields: ['name', 'address'],
  showAreaLabels: true,
  showPoiLabels: false,
  attributionFontSize: 11,
};

/**
 * Default light variant (colors with RGBA for opacity)
 */
export const DEFAULT_LIGHT_VARIANT: Omit<ThemeVariant, 'id'> = {
  scheme: 'light',
  backgroundColor: '#f0f0f0',
  waterColor: '#a0c4e8',
  landColor: '#e8e8e8',
  roadColor: 'rgba(255,255,255,0.8)',
  buildingFillColor: 'rgba(221,221,221,0.7)',
  buildingStrokeEnabled: false,
  buildingStrokeColor: 'rgba(204,204,204,0.5)',
  calloutLineColor: 'rgba(59,130,246,0.88)',
  calloutHoverLineColor: '#1d4ed8',
  calloutTextColor: '#1f2937',
  calloutHoverTextColor: '#111827',
  calloutDescriptionColor: 'rgba(107,114,128,0.8)',
  calloutHoverDescriptionColor: 'rgba(31,41,55,0.92)',
  calloutBackgroundColor: 'rgba(255,255,255,0.56)',
  calloutHoverBackgroundColor: 'rgba(255,255,255,0.98)',
  attributionColor: 'rgba(0,0,0,0.55)',
  labelTextColor: 'rgba(51,65,85,0.82)',
  clusterColor: 'rgba(15,23,42,0.08)',
  clusterHoverColor: 'rgba(15,23,42,0.14)',
  clusterTextColor: 'rgba(15,23,42,0.9)',
  clusterTextHoverColor: 'rgba(15,23,42,1)',
};

/**
 * Default dark variant (colors with RGBA for opacity)
 */
export const DEFAULT_DARK_VARIANT: Omit<ThemeVariant, 'id'> = {
  scheme: 'dark',
  backgroundColor: '#1a1a2e',
  waterColor: '#2a4a6e',
  landColor: '#252540',
  roadColor: 'rgba(58,58,90,0.8)',
  buildingFillColor: 'rgba(61,61,92,0.7)',
  buildingStrokeEnabled: false,
  buildingStrokeColor: 'rgba(74,74,106,0.5)',
  calloutLineColor: '#60a5fa',
  calloutHoverLineColor: '#93c5fd',
  calloutTextColor: '#f3f4f6',
  calloutHoverTextColor: '#ffffff',
  calloutDescriptionColor: 'rgba(209,213,219,0.8)',
  calloutHoverDescriptionColor: 'rgba(255,255,255,0.92)',
  calloutBackgroundColor: 'rgba(15,23,42,0.4)',
  calloutHoverBackgroundColor: 'rgba(15,23,42,0.94)',
  attributionColor: 'rgba(255,255,255,0.55)',
  labelTextColor: 'rgba(226,232,240,0.82)',
  clusterColor: 'rgba(248,250,252,0.08)',
  clusterHoverColor: 'rgba(248,250,252,0.16)',
  clusterTextColor: 'rgba(248,250,252,0.94)',
  clusterTextHoverColor: '#ffffff',
};

const { scheme: _initialLightScheme, ...initialLightVariantColors } = DEFAULT_LIGHT_VARIANT;

/** Explicit fixture/seed preview config. Runtime resolution never substitutes this on failure. */
export const INITIAL_MAP_THEME_LIGHT_CONFIG: ResolvedThemeConfig = {
  ...initialLightVariantColors,
  ...DEFAULT_THEME_SETTINGS,
};

/**
 * Create theme input schema
 */
export const createMapThemeInputSchema = z
  .object({
    name: MapThemeDocumentMetaSchema.shape.name,
    settings: MapThemeDocumentSettingsSchema,
    lightVariant: MapThemeDocumentVariantSchema.extend({ scheme: z.literal('light') }).strict(),
    darkVariant: MapThemeDocumentVariantSchema.extend({ scheme: z.literal('dark') }).strict(),
  })
  .strict();
