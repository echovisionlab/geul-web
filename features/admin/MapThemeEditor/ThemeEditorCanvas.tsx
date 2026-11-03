'use client';

import {
  parameterAction,
  parameterGroup,
  useParameterControls,
  ParameterPanel,
} from '@/components/core/ParameterPanel';
import {
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
import { SectionCard as DsSectionCard } from '@/components/core/Section';
import { Text as DsText } from '@/components/core/Typography';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Map as MapLibreGLMap } from 'maplibre-gl';
import { useTranslations } from 'next-intl';
import { isMapThemeColor } from '@echovisionlab/geul-common/collaboration/map-theme';
import { SegmentedControl, Switch } from '@/components/core/Input';
import type { MapRendererPlace } from '@/features/map/types';
import { PageLoader } from '@/features/site/PageLoader';
import type { CalloutField, ThemeSettings, ThemeVariant } from '@/lib/types/map-theme/model';
import { DEFAULT_DARK_VARIANT, DEFAULT_LIGHT_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';
const MapLibreMap = dynamic(() => import('@/features/map/MapLibreMap').then((mod) => mod.MapLibreMap), {
  ssr: false,
  loading: () => <PageLoader extent="container" />,
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
 * Parse color string to RGBA object for editable authored colors
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
  // Parameter controls - Map (base map colors)
  const mapParameters = useParameterControls(
    () => ({
      [tCommonLabels('map')]: parameterGroup(
        {
          backgroundColor: {
            kind: 'color',
            value: parseColorToRgba(variant.backgroundColor),
            label: tCommonLabels('background'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, backgroundColor: rgbaToString(v) }),
          },
          waterColor: {
            kind: 'color',
            value: parseColorToRgba(variant.waterColor),
            label: t('controls.map.water'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, waterColor: rgbaToString(v) }),
          },
          landColor: {
            kind: 'color',
            value: parseColorToRgba(variant.landColor),
            label: t('controls.map.land'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, landColor: rgbaToString(v) }),
          },
          roadColor: {
            kind: 'color',
            value: parseColorToRgba(variant.roadColor),
            label: t('controls.map.road'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, roadColor: rgbaToString(v) }),
          },
          [t('controls.map.reset')]: parameterAction(() => {
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
    [variant, onVariantChange, getDefaultVariant, t],
  );
  // Parameter controls - Building
  const buildingParameters = useParameterControls(
    () => ({
      [t('controls.building.title')]: parameterGroup(
        {
          buildingFillColor: {
            kind: 'color',
            value: parseColorToRgba(variant.buildingFillColor),
            label: t('controls.building.fill'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, buildingFillColor: rgbaToString(v) }),
          },
          buildingStrokeEnabled: {
            kind: 'checkbox',
            value: variant.buildingStrokeEnabled,
            label: t('controls.building.strokeEnabled'),
            onChange: (v: boolean) => onVariantChange({ ...variant, buildingStrokeEnabled: v }),
          },
          buildingStrokeColor: {
            kind: 'color',
            value: parseColorToRgba(variant.buildingStrokeColor),
            label: t('controls.building.stroke'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, buildingStrokeColor: rgbaToString(v) }),
          },
          [t('controls.building.reset')]: parameterAction(() => {
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
    [variant, onVariantChange, getDefaultVariant, t],
  );
  // Parameter controls - Callout (colors + layout + fields)
  const calloutParameters = useParameterControls(
    () => ({
      [t('callout.title')]: parameterGroup(
        {
          calloutLineColor: {
            kind: 'color',
            value: parseColorToRgba(variant.calloutLineColor),
            label: t('callout.line'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, calloutLineColor: rgbaToString(v) }),
          },
          calloutHoverLineColor: {
            kind: 'color',
            value: parseColorToRgba(variant.calloutHoverLineColor),
            label: t('callout.hoverLine'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, calloutHoverLineColor: rgbaToString(v) }),
          },
          calloutTextColor: {
            kind: 'color',
            value: parseColorToRgba(variant.calloutTextColor),
            label: tCommonLabels('text'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, calloutTextColor: rgbaToString(v) }),
          },
          calloutHoverTextColor: {
            kind: 'color',
            value: parseColorToRgba(variant.calloutHoverTextColor),
            label: t('callout.hoverText'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, calloutHoverTextColor: rgbaToString(v) }),
          },
          calloutDescriptionColor: {
            kind: 'color',
            value: parseColorToRgba(variant.calloutDescriptionColor),
            label: tCommonLabels('description'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, calloutDescriptionColor: rgbaToString(v) }),
          },
          calloutHoverDescriptionColor: {
            kind: 'color',
            value: parseColorToRgba(variant.calloutHoverDescriptionColor),
            label: t('callout.hoverDescription'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, calloutHoverDescriptionColor: rgbaToString(v) }),
          },
          calloutBackgroundColor: {
            kind: 'color',
            value: parseColorToRgba(variant.calloutBackgroundColor),
            label: tCommonLabels('background'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, calloutBackgroundColor: rgbaToString(v) }),
          },
          calloutHoverBackgroundColor: {
            kind: 'color',
            value: parseColorToRgba(variant.calloutHoverBackgroundColor),
            label: t('callout.hoverBackground'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, calloutHoverBackgroundColor: rgbaToString(v) }),
          },
          calloutScale: {
            kind: 'number',
            value: settings.calloutScale,
            min: 0.5,
            max: 2,
            step: 0.1,
            label: t('callout.scale'),
            onChange: (v: number) => onSettingsChange({ ...settings, calloutScale: v }),
          },
          calloutOffsetX: {
            kind: 'number',
            value: settings.calloutOffsetX,
            min: -50,
            max: 50,
            step: 1,
            label: t('callout.offsetX'),
            onChange: (v: number) => onSettingsChange({ ...settings, calloutOffsetX: v }),
          },
          calloutOffsetY: {
            kind: 'number',
            value: settings.calloutOffsetY,
            min: -50,
            max: 50,
            step: 1,
            label: t('callout.offsetY'),
            onChange: (v: number) => onSettingsChange({ ...settings, calloutOffsetY: v }),
          },
          // Callout fields as individual toggles
          ...Object.fromEntries(
            ALL_CALLOUT_FIELDS.map((field) => [
              `field_${field}`,
              {
                kind: 'checkbox',
                value: settings.calloutFields.includes(field),
                label: getCalloutFieldLabel(field, t, tCommonLabels),
                onChange: (enabled: boolean) => {
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
                },
              },
            ]),
          ),
          [t('callout.reset')]: parameterAction(() => {
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
    [variant, settings, onVariantChange, onSettingsChange, getDefaultVariant, t],
  );
  // Parameter controls - Attribution
  const attributionParameters = useParameterControls(
    () => ({
      [t('controls.attribution.title')]: parameterGroup(
        {
          attributionColor: {
            kind: 'color',
            value: parseColorToRgba(
              variant.attributionColor ??
                (variant.scheme === 'dark'
                  ? DEFAULT_DARK_VARIANT.attributionColor
                  : DEFAULT_LIGHT_VARIANT.attributionColor),
            ),
            label: t('controls.attribution.color'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, attributionColor: rgbaToString(v) }),
          },
          attributionFontSize: {
            kind: 'number',
            value: settings.attributionFontSize ?? 11,
            min: 9,
            max: 14,
            step: 1,
            label: tCommonLabels('fontSize'),
            onChange: (v: number) => onSettingsChange({ ...settings, attributionFontSize: v }),
          },
          [t('controls.attribution.reset')]: parameterAction(() => {
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
    [variant, settings, onVariantChange, onSettingsChange, getDefaultVariant, t],
  );
  const labelParameters = useParameterControls(
    () => ({
      [t('controls.labels.title')]: parameterGroup(
        {
          labelTextColor: {
            kind: 'color',
            value: parseColorToRgba(variant.labelTextColor),
            label: tCommonLabels('text'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, labelTextColor: rgbaToString(v) }),
          },
          showAreaLabels: {
            kind: 'checkbox',
            value: settings.showAreaLabels,
            label: t('controls.labels.areaRoad'),
            onChange: (v: boolean) => onSettingsChange({ ...settings, showAreaLabels: v }),
          },
          showPoiLabels: {
            kind: 'checkbox',
            value: settings.showPoiLabels,
            label: tMapControls('fields.poiLabels'),
            onChange: (v: boolean) => onSettingsChange({ ...settings, showPoiLabels: v }),
          },
          [t('controls.labels.reset')]: parameterAction(() => {
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
    [variant, settings, onVariantChange, onSettingsChange, getDefaultVariant, t],
  );
  const clusterParameters = useParameterControls(
    () => ({
      [t('controls.cluster.title')]: parameterGroup(
        {
          clusterColor: {
            kind: 'color',
            value: parseColorToRgba(variant.clusterColor),
            label: t('controls.cluster.bubble'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, clusterColor: rgbaToString(v) }),
          },
          clusterHoverColor: {
            kind: 'color',
            value: parseColorToRgba(variant.clusterHoverColor),
            label: t('controls.cluster.hoverBubble'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, clusterHoverColor: rgbaToString(v) }),
          },
          clusterTextColor: {
            kind: 'color',
            value: parseColorToRgba(variant.clusterTextColor),
            label: t('controls.cluster.count'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, clusterTextColor: rgbaToString(v) }),
          },
          clusterTextHoverColor: {
            kind: 'color',
            value: parseColorToRgba(variant.clusterTextHoverColor),
            label: t('controls.cluster.hoverCount'),
            onChange: (v: RgbaColor) => onVariantChange({ ...variant, clusterTextHoverColor: rgbaToString(v) }),
          },
          [t('controls.cluster.reset')]: parameterAction(() => {
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
    [variant, settings, onVariantChange, onSettingsChange, getDefaultVariant, t],
  );
  const cameraParameters =
    // Parameter controls - Camera
    // Note: deps array includes camera so the controlled model updates when camera state changes from map interaction
    useParameterControls(
      () => ({
        [tMapControls('folders.camera')]: parameterGroup(
          {
            zoom: {
              kind: 'number',
              value: camera.zoom,
              min: 10,
              max: 20,
              step: 0.5,
              label: tMapControls('fields.zoom'),
              onChange: (v: number) => setCamera((prev) => ({ ...prev, zoom: v })),
            },
            pitch: {
              kind: 'number',
              value: camera.pitch,
              min: 0,
              max: 85,
              step: 1,
              label: tMapControls('fields.pitch'),
              onChange: (v: number) => setCamera((prev) => ({ ...prev, pitch: v })),
            },
            bearing: {
              kind: 'number',
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
      [camera, tMapControls],
    );
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
    <div style={{ position: 'absolute', inset: 0 }}>
      {showControls && (
        <ParameterPanel
          placement="map-corner"
          title={tMapControls('settingsTitle')}
          model={{
            ...mapParameters,
            ...buildingParameters,
            ...calloutParameters,
            ...attributionParameters,
            ...labelParameters,
            ...clusterParameters,
            ...cameraParameters,
          }}
          copyLabel={(label) => tMapControls('copyValueTitle', { label })}
        />
      )}

      {/* View controls at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 10,
        }}
      >
        <DsSectionCard padding="none" appearance="surface" border="none">
          <DsLayoutInset space="xs">
            <DsLayoutInline gap="md">
              <DsLayoutStack gap="xxs">
                <DsText size="xs" tone="secondary">
                  {t('viewMode.label')}
                </DsText>
                <SegmentedControl
                  aria-label={t('viewMode.label')}
                  value={viewMode}
                  onChange={handleViewModeChange}
                  data={[
                    { label: t('viewMode.twoD'), value: '2d' },
                    { label: t('viewMode.threeD'), value: '3d' },
                  ]}
                  size="xs"
                />
              </DsLayoutStack>
              {viewMode === '3d' && (
                <DsLayoutStack gap="xxs">
                  <DsText size="xs" tone="secondary">
                    {tMapControls('fields.autoRotate')}
                  </DsText>
                  <Switch
                    aria-label={tMapControls('fields.autoRotate')}
                    checked={autoRotate}
                    onChange={(e) => handleAutoRotateChange(e.currentTarget.checked)}
                    size="sm"
                  />
                </DsLayoutStack>
              )}
              <DsLayoutStack gap="xxs">
                <DsText size="xs" tone="secondary">
                  {t('viewMode.mockPlaces')}
                </DsText>
                <SegmentedControl
                  aria-label={t('viewMode.mockPlaces')}
                  value={placesCount}
                  onChange={setPlacesCount}
                  data={[
                    { label: '0', value: '0' },
                    { label: '1', value: '1' },
                    { label: '3', value: '3' },
                  ]}
                  size="xs"
                />
              </DsLayoutStack>
            </DsLayoutInline>
          </DsLayoutInset>
        </DsSectionCard>
      </div>

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
        zoomPosition="bottom-right"
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
    </div>
  );
}
export function ThemeEditorCanvas(props: ThemeEditorCanvasProps) {
  return <ThemeEditorCanvasInner key={props.variant.scheme} {...props} />;
}
