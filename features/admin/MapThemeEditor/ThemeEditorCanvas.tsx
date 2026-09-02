'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { button, folder, LevaPanel, useControls, useCreateStore } from 'leva';
import type { Map as MapLibreGLMap } from 'maplibre-gl';
import { useTranslations } from 'next-intl';
import { Box, Group, Stack, Text } from '@mantine/core';
import { isMapThemeColor } from '@echovisionlab/geul-common/collaboration/map-theme';
import { SegmentedControl, Switch } from '@/components/core/Input';
import type { MapRendererPlace } from '@/features/map/types';
import { PageLoader } from '@/features/site/PageLoader';
import { useLevaSyncGuard } from '@/hooks/useLevaSync';
import type { CalloutField, ThemeSettings, ThemeVariant } from '@/lib/types/map-theme/model';
import { DEFAULT_DARK_VARIANT, DEFAULT_LIGHT_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';

const MapLibreMap = dynamic(() => import('@/features/map/MapLibreMap').then((mod) => mod.MapLibreMap), {
  ssr: false,
  loading: () => <PageLoader height="100%" />,
});

interface ThemeEditorCanvasProps {
  variant: Omit<ThemeVariant, 'id'>;
  settings: ThemeSettings;
  showControls?: boolean;
  onVariantChange: (variant: Omit<ThemeVariant, 'id'>) => void;
  onSettingsChange: (settings: ThemeSettings) => void;
}

type RgbaColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

interface ThemeEditorControlStores {
  light: ReturnType<typeof useCreateStore>;
  dark: ReturnType<typeof useCreateStore>;
}

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };
const ORBIT_SPEED = 0.05; // degrees per frame

// All available callout fields
const ALL_CALLOUT_FIELDS: CalloutField[] = [
  'name',
  'address',
  'coordinates',
  'street',
  'city',
  'region',
  'country',
  'postalCode',
];

type MapThemeEditorTranslation = ReturnType<typeof useTranslations>;

function getCalloutFieldLabel(
  field: CalloutField,
  t: MapThemeEditorTranslation,
  tCommonLabels: MapThemeEditorTranslation,
): string {
  if (field === 'name') {
    return tCommonLabels('name');
  }
  if (field === 'country') {
    return tCommonLabels('country');
  }
  if (field === 'address') {
    return tCommonLabels('address');
  }
  if (field === 'city') {
    return tCommonLabels('city');
  }
  if (field === 'postalCode') {
    return tCommonLabels('postalCode');
  }
  if (field === 'region') {
    return tCommonLabels('region');
  }
  if (field === 'coordinates') {
    return tCommonLabels('coordinates');
  }

  return t('callout.fields.street');
}

function getMockPlaces(t: MapThemeEditorTranslation): Record<string, MapRendererPlace[]> {
  return {
    '0': [],
    '1': [
      {
        id: 'mock-1',
        name: t('mockPlaces.one.name'),
        address: t('mockPlaces.one.address'),
        lat: 37.5665,
        lng: 126.978,
        addressComponents: {
          street: t('mockPlaces.one.street'),
          city: t('mockPlaces.one.city'),
          region: t('mockPlaces.one.region'),
          country: t('mockPlaces.one.country'),
          postalCode: '03181',
        },
      },
    ],
    '3': [
      {
        id: 'mock-1',
        name: t('mockPlaces.three.centralStation.name'),
        address: t('mockPlaces.three.centralStation.address'),
        lat: 37.5665,
        lng: 126.978,
        addressComponents: {
          street: t('mockPlaces.three.centralStation.street'),
          city: t('mockPlaces.three.centralStation.city'),
          region: t('mockPlaces.three.centralStation.region'),
          country: t('mockPlaces.three.centralStation.country'),
          postalCode: '04513',
        },
      },
      {
        id: 'mock-2',
        name: t('mockPlaces.three.cityHall.name'),
        address: t('mockPlaces.three.cityHall.address'),
        lat: 37.5683,
        lng: 126.9778,
        addressComponents: {
          street: t('mockPlaces.three.cityHall.street'),
          city: t('mockPlaces.three.cityHall.city'),
          region: t('mockPlaces.three.cityHall.region'),
          country: t('mockPlaces.three.cityHall.country'),
          postalCode: '04515',
        },
      },
      {
        id: 'mock-3',
        name: t('mockPlaces.three.artMuseum.name'),
        address: t('mockPlaces.three.artMuseum.address'),
        lat: 37.5649,
        lng: 126.9802,
        addressComponents: {
          street: t('mockPlaces.three.artMuseum.street'),
          city: t('mockPlaces.three.artMuseum.city'),
          region: t('mockPlaces.three.artMuseum.region'),
          country: t('mockPlaces.three.artMuseum.country'),
          postalCode: '03045',
        },
      },
    ],
  };
}

/**
 * Parse color string to RGBA object for Leva
 */
export function parseColorToRgba(color: string): RgbaColor {
  const normalizedColor = color.trim();
  if (!isMapThemeColor(normalizedColor)) {
    throw new Error('Unsupported Map Theme color');
  }

  // Handle transparent
  if (normalizedColor === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // Match the Common Map Theme contract, including whitespace around channels.
  const rgbaMatch = normalizedColor.match(
    /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*((?:0(?:\.\d+)?)|(?:1(?:\.0+)?))\s*\)$/i,
  );
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: parseFloat(rgbaMatch[4]),
    };
  }

  const rgbMatch = normalizedColor.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
      a: 1,
    };
  }

  // Expand #RGB and #RGBA before reading the canonical eight channels.
  let hex = normalizedColor.replace('#', '');
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (hex.length === 6) {
    hex += 'ff';
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = parseInt(hex.slice(6, 8), 16) / 255;

  return { r, g, b, a };
}

/**
 * Convert RGBA object to CSS rgba() string
 */
function rgbaToString(rgba: RgbaColor): string {
  if (rgba.a === 0) {
    return 'transparent';
  }
  if (rgba.a === 1) {
    const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
    return `#${toHex(rgba.r)}${toHex(rgba.g)}${toHex(rgba.b)}`;
  }
  return `rgba(${Math.round(rgba.r)},${Math.round(rgba.g)},${Math.round(rgba.b)},${rgba.a.toFixed(2)})`;
}

function ThemeEditorCanvasInner({
  variant,
  settings,
  showControls = true,
  onVariantChange,
  onSettingsChange,
}: ThemeEditorCanvasProps) {
  const t = useTranslations('adminList.mapThemes.editor');
  const tMapControls = useTranslations('mapControls');
  const tCommonLabels = useTranslations('common.labels');
  const lightControlsStore = useCreateStore();
  const darkControlsStore = useCreateStore();
  const controlStores: ThemeEditorControlStores = {
    light: lightControlsStore,
    dark: darkControlsStore,
  };
  const controlsStore = variant.scheme === 'dark' ? controlStores.dark : controlStores.light;
  const [placesCount, setPlacesCount] = useState<string>('1');
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [autoRotate, setAutoRotate] = useState(false);
  const mockPlaces = useMemo(() => getMockPlaces(t), [t]);

  const places = useMemo(() => mockPlaces[placesCount] ?? [], [mockPlaces, placesCount]);

  // Camera state (source of truth)
  const [camera, setCamera] = useState({
    zoom: 15,
    pitch: 0,
    bearing: 0,
  });

  // Map instance ref for direct manipulation during auto rotate
  const mapInstanceRef = useRef<MapLibreGLMap | null>(null);
  const animationRef = useRef<number | null>(null);
  const orbitBearingRef = useRef(0);

  // Get default variant based on current scheme
  const getDefaultVariant = useCallback(() => {
    return variant.scheme === 'dark' ? DEFAULT_DARK_VARIANT : DEFAULT_LIGHT_VARIANT;
  }, [variant.scheme]);

  // Guard to prevent onChange firing during scheme sync
  const { guardedOnChange, sync } = useLevaSyncGuard();

  // Leva controls - Map (base map colors)
  const [, setMapControls] = useControls(
    () => ({
      [tCommonLabels('map')]: folder(
        {
          backgroundColor: {
            value: parseColorToRgba(variant.backgroundColor),
            label: tCommonLabels('background'),
            onChange: guardedOnChange((v: RgbaColor) =>
              onVariantChange({ ...variant, backgroundColor: rgbaToString(v) }),
            ),
          },
          waterColor: {
            value: parseColorToRgba(variant.waterColor),
            label: t('controls.map.water'),
            onChange: guardedOnChange((v: RgbaColor) => onVariantChange({ ...variant, waterColor: rgbaToString(v) })),
          },
          landColor: {
            value: parseColorToRgba(variant.landColor),
            label: t('controls.map.land'),
            onChange: guardedOnChange((v: RgbaColor) => onVariantChange({ ...variant, landColor: rgbaToString(v) })),
          },
          roadColor: {
            value: parseColorToRgba(variant.roadColor),
            label: t('controls.map.road'),
            onChange: guardedOnChange((v: RgbaColor) => onVariantChange({ ...variant, roadColor: rgbaToString(v) })),
          },
          [t('controls.map.reset')]: button(() => {
            const defaults = getDefaultVariant();
            onVariantChange({
              ...variant,
              backgroundColor: defaults.backgroundColor,
              waterColor: defaults.waterColor,
              landColor: defaults.landColor,
              roadColor: defaults.roadColor,
            });
          }),
        },
        { collapsed: true },
      ),
    }),
    { store: controlsStore },
    [controlsStore, variant, onVariantChange, getDefaultVariant, guardedOnChange, t],
  );

  // Leva controls - Building
  const [, setBuildingControls] = useControls(
    () => ({
      [t('controls.building.title')]: folder(
        {
          buildingFillColor: {
            value: parseColorToRgba(variant.buildingFillColor),
            label: t('controls.building.fill'),
            onChange: guardedOnChange((v: RgbaColor) =>
              onVariantChange({ ...variant, buildingFillColor: rgbaToString(v) }),
            ),
          },
          buildingStrokeEnabled: {
            value: variant.buildingStrokeEnabled,
            label: t('controls.building.strokeEnabled'),
            onChange: guardedOnChange((v: boolean) => onVariantChange({ ...variant, buildingStrokeEnabled: v })),
          },
          buildingStrokeColor: {
            value: parseColorToRgba(variant.buildingStrokeColor),
            label: t('controls.building.stroke'),
            onChange: guardedOnChange((v: RgbaColor) =>
              onVariantChange({ ...variant, buildingStrokeColor: rgbaToString(v) }),
            ),
          },
          [t('controls.building.reset')]: button(() => {
            const defaults = getDefaultVariant();
            onVariantChange({
              ...variant,
              buildingFillColor: defaults.buildingFillColor,
              buildingStrokeEnabled: defaults.buildingStrokeEnabled,
              buildingStrokeColor: defaults.buildingStrokeColor,
            });
          }),
        },
        { collapsed: true },
      ),
    }),
    { store: controlsStore },
    [controlsStore, variant, onVariantChange, getDefaultVariant, guardedOnChange, t],
  );

  // Leva controls - Callout (colors + layout + fields)
  const [, setCalloutControls] = useControls(
    () => ({
      [t('callout.title')]: folder(
        {
          calloutLineColor: {
            value: parseColorToRgba(variant.calloutLineColor),
            label: t('callout.line'),
            onChange: guardedOnChange((v: RgbaColor) =>
              onVariantChange({ ...variant, calloutLineColor: rgbaToString(v) }),
            ),
          },
          calloutHoverLineColor: {
            value: parseColorToRgba(variant.calloutHoverLineColor),
            label: t('callout.hoverLine'),
            onChange: guardedOnChange((v: RgbaColor) =>
              onVariantChange({ ...variant, calloutHoverLineColor: rgbaToString(v) }),
            ),
          },
          calloutTextColor: {
            value: parseColorToRgba(variant.calloutTextColor),
            label: tCommonLabels('text'),
            onChange: guardedOnChange((v: RgbaColor) =>
              onVariantChange({ ...variant, calloutTextColor: rgbaToString(v) }),
            ),
          },
          calloutHoverTextColor: {
            value: parseColorToRgba(variant.calloutHoverTextColor),
            label: t('callout.hoverText'),
            onChange: guardedOnChange((v: RgbaColor) =>
              onVariantChange({ ...variant, calloutHoverTextColor: rgbaToString(v) }),
            ),
          },
          calloutDescriptionColor: {
            value: parseColorToRgba(variant.calloutDescriptionColor),
            label: tCommonLabels('description'),
            onChange: guardedOnChange((v: RgbaColor) =>
              onVariantChange({ ...variant, calloutDescriptionColor: rgbaToString(v) }),
            ),
          },
          calloutHoverDescriptionColor: {
            value: parseColorToRgba(variant.calloutHoverDescriptionColor),
            label: t('callout.hoverDescription'),
            onChange: guardedOnChange((v: RgbaColor) =>
              onVariantChange({ ...variant, calloutHoverDescriptionColor: rgbaToString(v) }),
            ),
          },
          calloutBackgroundColor: {
            value: parseColorToRgba(variant.calloutBackgroundColor),
            label: tCommonLabels('background'),
            onChange: guardedOnChange((v: RgbaColor) =>
              onVariantChange({ ...variant, calloutBackgroundColor: rgbaToString(v) }),
            ),
          },
          calloutHoverBackgroundColor: {
            value: parseColorToRgba(variant.calloutHoverBackgroundColor),
            label: t('callout.hoverBackground'),
            onChange: guardedOnChange((v: RgbaColor) =>
              onVariantChange({ ...variant, calloutHoverBackgroundColor: rgbaToString(v) }),
            ),
          },
          calloutScale: {
            value: settings.calloutScale,
            min: 0.5,
            max: 2,
            step: 0.1,
            label: t('callout.scale'),
            onChange: guardedOnChange((v: number) => onSettingsChange({ ...settings, calloutScale: v })),
          },
          calloutOffsetX: {
            value: settings.calloutOffsetX,
            min: -50,
            max: 50,
            step: 1,
            label: t('callout.offsetX'),
            onChange: guardedOnChange((v: number) => onSettingsChange({ ...settings, calloutOffsetX: v })),
          },
          calloutOffsetY: {
            value: settings.calloutOffsetY,
            min: -50,
            max: 50,
            step: 1,
            label: t('callout.offsetY'),
            onChange: guardedOnChange((v: number) => onSettingsChange({ ...settings, calloutOffsetY: v })),
          },
          // Callout fields as individual toggles
          ...Object.fromEntries(
            ALL_CALLOUT_FIELDS.map((field) => [
              `field_${field}`,
              {
                value: settings.calloutFields.includes(field),
                label: getCalloutFieldLabel(field, t, tCommonLabels),
                onChange: guardedOnChange((enabled: boolean) => {
                  const isEnabled = settings.calloutFields.includes(field);
                  if (enabled === isEnabled) {
                    return;
                  }
                  const newFields = enabled
                    ? [...settings.calloutFields, field]
                    : settings.calloutFields.filter((f) => f !== field);
                  if (newFields.length > 0) {
                    onSettingsChange({ ...settings, calloutFields: newFields });
                  }
                }),
              },
            ]),
          ),
          [t('callout.reset')]: button(() => {
            const defaults = getDefaultVariant();
            onVariantChange({
              ...variant,
              calloutLineColor: defaults.calloutLineColor,
              calloutHoverLineColor: defaults.calloutHoverLineColor,
              calloutTextColor: defaults.calloutTextColor,
              calloutHoverTextColor: defaults.calloutHoverTextColor,
              calloutDescriptionColor: defaults.calloutDescriptionColor,
              calloutHoverDescriptionColor: defaults.calloutHoverDescriptionColor,
              calloutBackgroundColor: defaults.calloutBackgroundColor,
              calloutHoverBackgroundColor: defaults.calloutHoverBackgroundColor,
            });
            onSettingsChange({
              ...settings,
              calloutScale: DEFAULT_THEME_SETTINGS.calloutScale,
              calloutOffsetX: DEFAULT_THEME_SETTINGS.calloutOffsetX,
              calloutOffsetY: DEFAULT_THEME_SETTINGS.calloutOffsetY,
              calloutFields: DEFAULT_THEME_SETTINGS.calloutFields,
            });
          }),
        },
        { collapsed: true },
      ),
    }),
    { store: controlsStore },
    [controlsStore, variant, settings, onVariantChange, onSettingsChange, getDefaultVariant, guardedOnChange, t],
  );

  // Leva controls - Attribution
  const [, setAttributionControls] = useControls(
    () => ({
      [t('controls.attribution.title')]: folder(
        {
          attributionColor: {
            value: parseColorToRgba(variant.attributionColor ?? 'rgba(128,128,128,0.55)'),
            label: t('controls.attribution.color'),
            onChange: guardedOnChange((v: RgbaColor) =>
              onVariantChange({ ...variant, attributionColor: rgbaToString(v) }),
            ),
          },
          attributionFontSize: {
            value: settings.attributionFontSize ?? 11,
            min: 9,
            max: 14,
            step: 1,
            label: tCommonLabels('fontSize'),
            onChange: guardedOnChange((v: number) => onSettingsChange({ ...settings, attributionFontSize: v })),
          },
          [t('controls.attribution.reset')]: button(() => {
            const defaults = getDefaultVariant();
            onVariantChange({
              ...variant,
              attributionColor: defaults.attributionColor,
            });
            onSettingsChange({
              ...settings,
              attributionFontSize: DEFAULT_THEME_SETTINGS.attributionFontSize,
            });
          }),
        },
        { collapsed: true },
      ),
    }),
    { store: controlsStore },
    [controlsStore, variant, settings, onVariantChange, onSettingsChange, getDefaultVariant, guardedOnChange, t],
  );

  const [, setLabelControls] = useControls(
    () => ({
      [t('controls.labels.title')]: folder(
        {
          labelTextColor: {
            value: parseColorToRgba(variant.labelTextColor),
            label: tCommonLabels('text'),
            onChange: guardedOnChange((v: RgbaColor) =>
              onVariantChange({ ...variant, labelTextColor: rgbaToString(v) }),
            ),
          },
          showAreaLabels: {
            value: settings.showAreaLabels,
            label: t('controls.labels.areaRoad'),
            onChange: guardedOnChange((v: boolean) => onSettingsChange({ ...settings, showAreaLabels: v })),
          },
          showPoiLabels: {
            value: settings.showPoiLabels,
            label: tMapControls('fields.poiLabels'),
            onChange: guardedOnChange((v: boolean) => onSettingsChange({ ...settings, showPoiLabels: v })),
          },
          [t('controls.labels.reset')]: button(() => {
            const defaults = getDefaultVariant();
            onVariantChange({
              ...variant,
              labelTextColor: defaults.labelTextColor,
            });
            onSettingsChange({
              ...settings,
              showAreaLabels: DEFAULT_THEME_SETTINGS.showAreaLabels,
              showPoiLabels: DEFAULT_THEME_SETTINGS.showPoiLabels,
            });
          }),
        },
        { collapsed: true },
      ),
    }),
    { store: controlsStore },
    [controlsStore, variant, settings, onVariantChange, onSettingsChange, getDefaultVariant, guardedOnChange, t],
  );

  const [, setClusterControls] = useControls(
    () => ({
      [t('controls.cluster.title')]: folder(
        {
          clusterColor: {
            value: parseColorToRgba(variant.clusterColor),
            label: t('controls.cluster.bubble'),
            onChange: guardedOnChange((v: RgbaColor) => onVariantChange({ ...variant, clusterColor: rgbaToString(v) })),
          },
          clusterHoverColor: {
            value: parseColorToRgba(variant.clusterHoverColor),
            label: t('controls.cluster.hoverBubble'),
            onChange: guardedOnChange((v: RgbaColor) =>
              onVariantChange({ ...variant, clusterHoverColor: rgbaToString(v) }),
            ),
          },
          clusterTextColor: {
            value: parseColorToRgba(variant.clusterTextColor),
            label: t('controls.cluster.count'),
            onChange: guardedOnChange((v: RgbaColor) =>
              onVariantChange({ ...variant, clusterTextColor: rgbaToString(v) }),
            ),
          },
          clusterTextHoverColor: {
            value: parseColorToRgba(variant.clusterTextHoverColor),
            label: t('controls.cluster.hoverCount'),
            onChange: guardedOnChange((v: RgbaColor) =>
              onVariantChange({ ...variant, clusterTextHoverColor: rgbaToString(v) }),
            ),
          },
          [t('controls.cluster.reset')]: button(() => {
            const defaults = getDefaultVariant();
            onVariantChange({
              ...variant,
              clusterColor: defaults.clusterColor,
              clusterHoverColor: defaults.clusterHoverColor,
              clusterTextColor: defaults.clusterTextColor,
              clusterTextHoverColor: defaults.clusterTextHoverColor,
            });
          }),
        },
        { collapsed: true },
      ),
    }),
    { store: controlsStore },
    [controlsStore, variant, settings, onVariantChange, onSettingsChange, getDefaultVariant, guardedOnChange, t],
  );

  // Leva controls - Camera
  // Note: deps array includes camera so Leva re-renders when camera state changes from map interaction
  useControls(
    () => ({
      [tMapControls('folders.camera')]: folder(
        {
          zoom: {
            value: camera.zoom,
            min: 10,
            max: 20,
            step: 0.5,
            label: tMapControls('fields.zoom'),
            onChange: (v: number) => setCamera((prev) => ({ ...prev, zoom: v })),
          },
          pitch: {
            value: camera.pitch,
            min: 0,
            max: 85,
            step: 1,
            label: tMapControls('fields.pitch'),
            onChange: (v: number) => setCamera((prev) => ({ ...prev, pitch: v })),
          },
          bearing: {
            value: camera.bearing,
            min: -180,
            max: 180,
            step: 1,
            label: tMapControls('fields.bearing'),
            onChange: (v: number) => setCamera((prev) => ({ ...prev, bearing: v })),
          },
        },
        { collapsed: true },
      ),
    }),
    { store: controlsStore },
    [camera, controlsStore, tMapControls],
  );

  useEffect(() => {
    sync(setMapControls as (values: Record<string, unknown>) => void, {
      backgroundColor: parseColorToRgba(variant.backgroundColor),
      waterColor: parseColorToRgba(variant.waterColor),
      landColor: parseColorToRgba(variant.landColor),
      roadColor: parseColorToRgba(variant.roadColor),
    });
  }, [variant.backgroundColor, variant.waterColor, variant.landColor, variant.roadColor, setMapControls, sync]);

  useEffect(() => {
    sync(setBuildingControls as (values: Record<string, unknown>) => void, {
      buildingFillColor: parseColorToRgba(variant.buildingFillColor),
      buildingStrokeEnabled: variant.buildingStrokeEnabled,
      buildingStrokeColor: parseColorToRgba(variant.buildingStrokeColor),
    });
  }, [
    variant.buildingFillColor,
    variant.buildingStrokeEnabled,
    variant.buildingStrokeColor,
    setBuildingControls,
    sync,
  ]);

  useEffect(() => {
    sync(setCalloutControls as (values: Record<string, unknown>) => void, {
      calloutLineColor: parseColorToRgba(variant.calloutLineColor),
      calloutHoverLineColor: parseColorToRgba(variant.calloutHoverLineColor),
      calloutTextColor: parseColorToRgba(variant.calloutTextColor),
      calloutHoverTextColor: parseColorToRgba(variant.calloutHoverTextColor),
      calloutDescriptionColor: parseColorToRgba(variant.calloutDescriptionColor),
      calloutHoverDescriptionColor: parseColorToRgba(variant.calloutHoverDescriptionColor),
      calloutBackgroundColor: parseColorToRgba(variant.calloutBackgroundColor),
      calloutHoverBackgroundColor: parseColorToRgba(variant.calloutHoverBackgroundColor),
      calloutScale: settings.calloutScale,
      calloutOffsetX: settings.calloutOffsetX,
      calloutOffsetY: settings.calloutOffsetY,
      ...Object.fromEntries(
        ALL_CALLOUT_FIELDS.map((field) => [`field_${field}`, settings.calloutFields.includes(field)]),
      ),
    });
  }, [
    variant.calloutLineColor,
    variant.calloutHoverLineColor,
    variant.calloutTextColor,
    variant.calloutHoverTextColor,
    variant.calloutDescriptionColor,
    variant.calloutHoverDescriptionColor,
    variant.calloutBackgroundColor,
    variant.calloutHoverBackgroundColor,
    settings.calloutScale,
    settings.calloutOffsetX,
    settings.calloutOffsetY,
    settings.calloutFields,
    setCalloutControls,
    sync,
  ]);

  useEffect(() => {
    sync(setAttributionControls as (values: Record<string, unknown>) => void, {
      attributionColor: parseColorToRgba(variant.attributionColor),
      attributionFontSize: settings.attributionFontSize,
    });
  }, [variant.attributionColor, settings.attributionFontSize, setAttributionControls, sync]);

  useEffect(() => {
    sync(setLabelControls as (values: Record<string, unknown>) => void, {
      labelTextColor: parseColorToRgba(variant.labelTextColor),
      showAreaLabels: settings.showAreaLabels,
      showPoiLabels: settings.showPoiLabels,
    });
  }, [variant.labelTextColor, settings.showAreaLabels, settings.showPoiLabels, setLabelControls, sync]);

  useEffect(() => {
    sync(setClusterControls as (values: Record<string, unknown>) => void, {
      clusterColor: parseColorToRgba(variant.clusterColor),
      clusterHoverColor: parseColorToRgba(variant.clusterHoverColor),
      clusterTextColor: parseColorToRgba(variant.clusterTextColor),
      clusterTextHoverColor: parseColorToRgba(variant.clusterTextHoverColor),
    });
  }, [
    variant.clusterColor,
    variant.clusterHoverColor,
    variant.clusterTextColor,
    variant.clusterTextHoverColor,
    setClusterControls,
    sync,
  ]);

  // Auto rotate animation - directly manipulates map instance, no React state
  useEffect(() => {
    if (!autoRotate || !mapInstanceRef.current) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const map = mapInstanceRef.current;
    orbitBearingRef.current = map.getBearing();

    const animate = () => {
      if (!mapInstanceRef.current) {
        return;
      }

      orbitBearingRef.current = (orbitBearingRef.current + ORBIT_SPEED) % 360;
      if (orbitBearingRef.current > 180) {
        orbitBearingRef.current -= 360;
      }

      mapInstanceRef.current.setBearing(orbitBearingRef.current);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [autoRotate]);

  // Handle view mode change
  const handleViewModeChange = useCallback((mode: string) => {
    const newMode = mode as '2d' | '3d';
    setViewMode(newMode);
    if (newMode === '2d') {
      setAutoRotate(false);
    }
    if (newMode === '3d') {
      setCamera({ zoom: 16, pitch: 60, bearing: -20 });
    } else {
      setCamera({ zoom: 15, pitch: 0, bearing: 0 });
    }
  }, []);

  const handleAutoRotateChange = useCallback((checked: boolean) => {
    setAutoRotate(checked);
  }, []);

  const show3DBuildings = viewMode === '3d';

  // Combined theme config for map (variant + settings without id/scheme)
  const themeConfig = useMemo(() => {
    const { scheme: _, ...variantConfig } = variant;
    return { ...variantConfig, ...settings };
  }, [variant, settings]);

  // Handle map ready
  const handleMapReady = useCallback((map: MapLibreGLMap) => {
    mapInstanceRef.current = map;
  }, []);

  return (
    <Box pos="absolute" inset={0}>
      {showControls && (
        <Box
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
            width: 280,
          }}
        >
          <LevaPanel
            key={variant.scheme}
            fill
            flat
            store={controlsStore}
            titleBar={false}
            theme={{
              sizes: { rootWidth: '280px' },
            }}
          />
        </Box>
      )}

      {/* View controls at bottom */}
      <Box
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 10,
        }}
      >
        <Group
          gap="md"
          p="xs"
          style={{
            background: 'var(--mantine-color-body)',
            borderRadius: 'var(--mantine-radius-md)',
            boxShadow: 'var(--mantine-shadow-sm)',
          }}
        >
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              {t('viewMode.label')}
            </Text>
            <SegmentedControl
              value={viewMode}
              onChange={handleViewModeChange}
              data={[
                { label: t('viewMode.twoD'), value: '2d' },
                { label: t('viewMode.threeD'), value: '3d' },
              ]}
              size="xs"
            />
          </Stack>
          {viewMode === '3d' && (
            <Stack gap={4}>
              <Text size="xs" c="dimmed">
                {tMapControls('fields.autoRotate')}
              </Text>
              <Switch
                checked={autoRotate}
                onChange={(e) => handleAutoRotateChange(e.currentTarget.checked)}
                size="sm"
              />
            </Stack>
          )}
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              {t('viewMode.mockPlaces')}
            </Text>
            <SegmentedControl
              value={placesCount}
              onChange={setPlacesCount}
              data={[
                { label: '0', value: '0' },
                { label: '1', value: '1' },
                { label: '3', value: '3' },
              ]}
              size="xs"
            />
          </Stack>
        </Group>
      </Box>

      {/* Map */}
      <MapLibreMap
        key={variant.scheme}
        places={places}
        cluster={places.length > 1}
        center={DEFAULT_CENTER}
        zoom={camera.zoom}
        pitch={camera.pitch}
        bearing={camera.bearing}
        height="100%"
        themeConfig={themeConfig}
        draggable={!autoRotate}
        zoomable
        rotatable={!autoRotate}
        tiltable
        showNavigation
        show3DBuildings={show3DBuildings}
        onMapReady={handleMapReady}
        onZoomChange={(v) => {
          setCamera((prev) => ({ ...prev, zoom: v }));
        }}
        onPitchChange={(v) => {
          setCamera((prev) => ({ ...prev, pitch: v }));
        }}
        onBearingChange={(v) => {
          // Only update camera state when not auto rotating
          if (!autoRotate) {
            setCamera((prev) => ({ ...prev, bearing: v }));
          }
        }}
      />
    </Box>
  );
}

export function ThemeEditorCanvas(props: ThemeEditorCanvasProps) {
  return <ThemeEditorCanvasInner key={props.variant.scheme} {...props} />;
}
