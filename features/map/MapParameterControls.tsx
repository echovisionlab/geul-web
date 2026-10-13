'use client';

import { parameterAction, parameterGroup, useParameterControls } from '@/components/core/ParameterPanel';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  clampMapZoom,
  MAP_MAX_ZOOM_LIMIT,
  MAP_MIN_ZOOM_LIMIT,
  normalizeMapZoomBounds,
  type MapConfig,
  type MapLabelVisibilityMode,
  type MapPreferredScheme,
} from '@/lib/types/map/model';
export interface MapThemeListItem {
  id: string;
  name: string;
}
interface UseMapParameterControlsOptions {
  config: MapConfig;
  onConfigChange: (updates: Partial<MapConfig>) => void;
  themes?: MapThemeListItem[];
  /** Number of places currently selected */
  placesCount?: number;
  /** Callback to open places management modal */
  onManagePlaces?: () => void;
}
/**
 * Controlled parameter model for MapConfig editing.
 * Provides Theme, Camera, Display, and Interaction controls.
 */
export function useMapParameterControls({
  config,
  onConfigChange,
  themes,
  placesCount = 0,
  onManagePlaces,
}: UseMapParameterControlsOptions) {
  const t = useTranslations('mapControls');
  const tMap = useTranslations('map');
  // Use refs to avoid stale closures in parameter change handlers
  const configRef = useRef(config);
  const onManagePlacesRef = useRef(onManagePlaces);
  onManagePlacesRef.current = onManagePlaces;
  useEffect(() => {
    configRef.current = config;
  }, [config]);
  // Wrapper for onChange that applies guard and transforms value to partial config
  const safeOnChange =
    <T,>(updater: (v: T) => Partial<MapConfig>) =>
    (v: T) =>
      onConfigChange(updater(v));
  const updateZoomBounds = (nextBounds: Partial<Pick<MapConfig, 'minZoom' | 'maxZoom'>>) => {
    const bounds = normalizeMapZoomBounds({
      minZoom: nextBounds.minZoom ?? configRef.current.minZoom,
      maxZoom: nextBounds.maxZoom ?? configRef.current.maxZoom,
    });
    onConfigChange({
      ...bounds,
      zoom: clampMapZoom(configRef.current.zoom, bounds),
    });
  };
  // Build theme options for theme choices
  const themeOptions = useMemo(() => {
    const options: Record<string, string> = { [t('themeOptions.none')]: '' };
    themes?.forEach((theme) => {
      options[theme.name] = theme.id;
    });
    return options;
  }, [themes, t]);
  const placesLabel = placesCount > 0 ? t('managePlacesWithCount', { count: placesCount }) : t('managePlaces');
  const model = useParameterControls(
    () => ({
      [placesLabel]: parameterAction(() => onManagePlacesRef.current?.(), {
        disabled: !onManagePlaces,
      }),
      [t('folders.theme')]: parameterGroup(
        {
          themeId: {
            kind: 'select',
            value: config.themeId ?? '',
            options: themeOptions,
            label: t('fields.theme'),
            onChange: safeOnChange((v: string) => ({ themeId: v || undefined })),
          },
          preferredScheme: {
            kind: 'select',
            value: config.preferredScheme ?? 'auto',
            options: {
              [t('scheme.auto')]: 'auto',
              [t('scheme.light')]: 'light',
              [t('scheme.dark')]: 'dark',
            },
            label: t('fields.colorScheme'),
            onChange: safeOnChange((v: string) => ({ preferredScheme: v as MapPreferredScheme })),
          },
          areaLabelsMode: {
            kind: 'select',
            value: config.areaLabelsMode ?? 'inherit',
            options: {
              [t('visibility.inherit')]: 'inherit',
              [t('visibility.show')]: 'show',
              [t('visibility.hide')]: 'hide',
            },
            label: t('fields.areaLabels'),
            onChange: safeOnChange((v: string) => ({ areaLabelsMode: v as MapLabelVisibilityMode })),
          },
          poiLabelsMode: {
            kind: 'select',
            value: config.poiLabelsMode ?? 'inherit',
            options: {
              [t('visibility.inherit')]: 'inherit',
              [t('visibility.show')]: 'show',
              [t('visibility.hide')]: 'hide',
            },
            label: t('fields.poiLabels'),
            onChange: safeOnChange((v: string) => ({ poiLabelsMode: v as MapLabelVisibilityMode })),
          },
        },
        { collapsed: true },
      ),
      [t('folders.camera')]: parameterGroup(
        {
          zoom: {
            kind: 'number',
            value: config.zoom,
            min: config.minZoom,
            max: config.maxZoom,
            step: 0.1,
            label: t('fields.zoom'),
            onEditEnd: safeOnChange((v: number) => ({ zoom: v })),
          },
          minZoom: {
            kind: 'number',
            value: config.minZoom,
            min: MAP_MIN_ZOOM_LIMIT,
            max: MAP_MAX_ZOOM_LIMIT,
            step: 0.1,
            label: t('fields.minZoom'),
            onEditEnd: (v: number) => updateZoomBounds({ minZoom: v }),
          },
          maxZoom: {
            kind: 'number',
            value: config.maxZoom,
            min: MAP_MIN_ZOOM_LIMIT,
            max: MAP_MAX_ZOOM_LIMIT,
            step: 0.1,
            label: t('fields.maxZoom'),
            onEditEnd: (v: number) => updateZoomBounds({ maxZoom: v }),
          },
          pitch: {
            kind: 'number',
            value: config.pitch,
            min: 0,
            max: 85,
            step: 1,
            label: t('fields.pitch'),
            onEditEnd: safeOnChange((v: number) => ({ pitch: v })),
          },
          bearing: {
            kind: 'number',
            value: config.bearing,
            min: -180,
            max: 180,
            step: 1,
            label: t('fields.bearing'),
            onEditEnd: safeOnChange((v: number) => ({ bearing: v })),
          },
        },
        { collapsed: true },
      ),
      [t('folders.display')]: parameterGroup(
        {
          show3DBuildings: {
            kind: 'checkbox',
            value: config.show3DBuildings,
            label: t('fields.show3DBuildings'),
            onChange: safeOnChange((v: boolean) => {
              if (!v) {
                return { show3DBuildings: false };
              }
              const updates: Partial<MapConfig> = { show3DBuildings: true };
              // 3D toggle should produce a visible 3D result immediately.
              if (configRef.current.pitch < 30) {
                updates.pitch = 45;
              }
              if (!configRef.current.tiltable) {
                updates.tiltable = true;
              }
              return updates;
            }),
          },
          autoRotate: {
            kind: 'checkbox',
            value: config.autoRotate,
            label: t('fields.autoRotate'),
            onChange: safeOnChange((v: boolean) => ({ autoRotate: v })),
          },
          autoRotateSpeed: {
            kind: 'number',
            value: config.autoRotateSpeed,
            label: t('fields.rotateSpeed'),
            min: 1,
            max: 30,
            step: 1,
            onEditEnd: safeOnChange((v: number) => ({ autoRotateSpeed: v })),
          },
          aspectRatio: {
            kind: 'select',
            value: config.aspectRatio,
            options: { '16:9': '16:9', '4:3': '4:3', '1:1': '1:1' },
            label: t('fields.aspectRatio'),
            onChange: safeOnChange((v: string) => ({ aspectRatio: v as MapConfig['aspectRatio'] })),
          },
        },
        { collapsed: true },
      ),
      [t('folders.interaction')]: parameterGroup(
        {
          draggable: {
            kind: 'checkbox',
            value: config.draggable,
            label: t('fields.draggable'),
            onChange: safeOnChange((v: boolean) => ({ draggable: v })),
          },
          zoomable: {
            kind: 'checkbox',
            value: config.zoomable,
            label: t('fields.zoomable'),
            onChange: safeOnChange((v: boolean) => ({ zoomable: v })),
          },
          rotatable: {
            kind: 'checkbox',
            value: config.rotatable,
            label: t('fields.rotatable'),
            onChange: safeOnChange((v: boolean) => ({ rotatable: v })),
          },
          tiltable: {
            kind: 'checkbox',
            value: config.tiltable,
            label: t('fields.tiltable'),
            onChange: safeOnChange((v: boolean) => ({ tiltable: v })),
          },
          pinClickable: {
            kind: 'checkbox',
            value: config.pinClickable,
            label: t('fields.pinClickable'),
            onChange: safeOnChange((v: boolean) => ({ pinClickable: v })),
          },
          showDirections: {
            kind: 'checkbox',
            value: config.showDirections,
            label: tMap('directions'),
            onChange: safeOnChange((v: boolean) => ({ showDirections: v })),
          },
        },
        { collapsed: true },
      ),
    }),
    [config, onConfigChange, onManagePlaces, placesLabel, t, tMap, themeOptions],
  );
  return { model };
}
