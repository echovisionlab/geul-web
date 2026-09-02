'use client';

import { useEffect, useMemo, useRef } from 'react';
import { button, folder, useControls } from 'leva';
import { useTranslations } from 'next-intl';
import { useLevaSyncGuard } from '@/hooks/useLevaSync';
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

interface UseMapLevaControlsOptions {
  config: MapConfig;
  onConfigChange: (updates: Partial<MapConfig>) => void;
  themes?: MapThemeListItem[];
  /** Number of places currently selected */
  placesCount?: number;
  /** Callback to open places management modal */
  onManagePlaces?: () => void;
}

/**
 * Leva controls hook for MapConfig editing.
 * Provides Theme, Camera, Display, and Interaction controls.
 */
export function useMapLevaControls({
  config,
  onConfigChange,
  themes,
  placesCount = 0,
  onManagePlaces,
}: UseMapLevaControlsOptions) {
  const t = useTranslations('mapControls');
  const tMap = useTranslations('map');
  // Use refs to avoid stale closures in leva onChange handlers
  const configRef = useRef(config);
  const onManagePlacesRef = useRef(onManagePlaces);
  onManagePlacesRef.current = onManagePlaces;

  // Guard to prevent onChange firing during external sync
  const { guardedOnChange, sync } = useLevaSyncGuard();

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Wrapper for onChange that applies guard and transforms value to partial config
  const safeOnChange = <T,>(updater: (v: T) => Partial<MapConfig>) =>
    guardedOnChange((v: T) => onConfigChange(updater(v)));

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

  // Build theme options for Leva dropdown
  const themeOptions = useMemo(() => {
    const options: Record<string, string> = { [t('themeOptions.none')]: '' };
    themes?.forEach((theme) => {
      options[theme.name] = theme.id;
    });
    return options;
  }, [themes, t]);

  const placesLabel = placesCount > 0 ? t('managePlacesWithCount', { count: placesCount }) : t('managePlaces');

  const [, set] = useControls(
    () => ({
      [placesLabel]: button(() => onManagePlacesRef.current?.(), {
        disabled: !onManagePlaces,
      }),
      [t('folders.theme')]: folder(
        {
          themeId: {
            value: config.themeId ?? '',
            options: themeOptions,
            label: t('fields.theme'),
            onChange: safeOnChange((v: string) => ({ themeId: v || undefined })),
          },
          preferredScheme: {
            value: config.preferredScheme ?? 'auto',
            options: {
              [t('scheme.auto')]: 'auto',
              [t('scheme.light')]: 'light',
              [t('scheme.dark')]: 'dark',
            },
            label: t('fields.colorScheme'),
            onChange: safeOnChange((v: MapPreferredScheme) => ({ preferredScheme: v })),
          },
          areaLabelsMode: {
            value: config.areaLabelsMode ?? 'inherit',
            options: {
              [t('visibility.inherit')]: 'inherit',
              [t('visibility.show')]: 'show',
              [t('visibility.hide')]: 'hide',
            },
            label: t('fields.areaLabels'),
            onChange: safeOnChange((v: MapLabelVisibilityMode) => ({ areaLabelsMode: v })),
          },
          poiLabelsMode: {
            value: config.poiLabelsMode ?? 'inherit',
            options: {
              [t('visibility.inherit')]: 'inherit',
              [t('visibility.show')]: 'show',
              [t('visibility.hide')]: 'hide',
            },
            label: t('fields.poiLabels'),
            onChange: safeOnChange((v: MapLabelVisibilityMode) => ({ poiLabelsMode: v })),
          },
        },
        { collapsed: true },
      ),
      [t('folders.camera')]: folder(
        {
          zoom: {
            value: config.zoom,
            min: config.minZoom,
            max: config.maxZoom,
            step: 0.1,
            label: t('fields.zoom'),
            onEditEnd: safeOnChange((v: number) => ({ zoom: v })),
          },
          minZoom: {
            value: config.minZoom,
            min: MAP_MIN_ZOOM_LIMIT,
            max: MAP_MAX_ZOOM_LIMIT,
            step: 0.1,
            label: t('fields.minZoom'),
            onEditEnd: guardedOnChange((v: number) => updateZoomBounds({ minZoom: v })),
          },
          maxZoom: {
            value: config.maxZoom,
            min: MAP_MIN_ZOOM_LIMIT,
            max: MAP_MAX_ZOOM_LIMIT,
            step: 0.1,
            label: t('fields.maxZoom'),
            onEditEnd: guardedOnChange((v: number) => updateZoomBounds({ maxZoom: v })),
          },
          pitch: {
            value: config.pitch,
            min: 0,
            max: 85,
            step: 1,
            label: t('fields.pitch'),
            onEditEnd: safeOnChange((v: number) => ({ pitch: v })),
          },
          bearing: {
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
      [t('folders.display')]: folder(
        {
          show3DBuildings: {
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
            value: config.autoRotate,
            label: t('fields.autoRotate'),
            onChange: safeOnChange((v: boolean) => ({ autoRotate: v })),
          },
          autoRotateSpeed: {
            value: config.autoRotateSpeed,
            label: t('fields.rotateSpeed'),
            min: 1,
            max: 30,
            step: 1,
            onEditEnd: safeOnChange((v: number) => ({ autoRotateSpeed: v })),
          },
          aspectRatio: {
            value: config.aspectRatio,
            options: { '16:9': '16:9', '4:3': '4:3', '1:1': '1:1' },
            label: t('fields.aspectRatio'),
            onChange: safeOnChange((v: '16:9' | '4:3' | '1:1') => ({ aspectRatio: v })),
          },
        },
        { collapsed: true },
      ),
      [t('folders.interaction')]: folder(
        {
          draggable: {
            value: config.draggable,
            label: t('fields.draggable'),
            onChange: safeOnChange((v: boolean) => ({ draggable: v })),
          },
          zoomable: {
            value: config.zoomable,
            label: t('fields.zoomable'),
            onChange: safeOnChange((v: boolean) => ({ zoomable: v })),
          },
          rotatable: {
            value: config.rotatable,
            label: t('fields.rotatable'),
            onChange: safeOnChange((v: boolean) => ({ rotatable: v })),
          },
          tiltable: {
            value: config.tiltable,
            label: t('fields.tiltable'),
            onChange: safeOnChange((v: boolean) => ({ tiltable: v })),
          },
          pinClickable: {
            value: config.pinClickable,
            label: t('fields.pinClickable'),
            onChange: safeOnChange((v: boolean) => ({ pinClickable: v })),
          },
          showDirections: {
            value: config.showDirections,
            label: tMap('directions'),
            onChange: safeOnChange((v: boolean) => ({ showDirections: v })),
          },
        },
        { collapsed: true },
      ),
    }),
    [config.maxZoom, config.minZoom, onManagePlaces, placesLabel, t, tMap, themeOptions],
  );

  // Sync camera values from external changes (map interaction, collaboration)
  useEffect(() => {
    sync(set as (values: Record<string, unknown>) => void, {
      zoom: config.zoom,
      minZoom: config.minZoom,
      maxZoom: config.maxZoom,
      pitch: config.pitch,
      bearing: config.bearing,
    });
  }, [config.zoom, config.minZoom, config.maxZoom, config.pitch, config.bearing, set, sync]);

  useEffect(() => {
    sync(set as (values: Record<string, unknown>) => void, {
      themeId: config.themeId ?? '',
      preferredScheme: config.preferredScheme ?? 'auto',
      areaLabelsMode: config.areaLabelsMode ?? 'inherit',
      poiLabelsMode: config.poiLabelsMode ?? 'inherit',
    });
  }, [config.themeId, config.preferredScheme, config.areaLabelsMode, config.poiLabelsMode, set, sync]);

  // Keep durable interaction settings authoritative when the document changes
  // through Tiptap, collaboration, or undo/redo. Leva's local store must not
  // retain a stale toggle value that disagrees with the live MapLibre handlers.
  useEffect(() => {
    sync(set as (values: Record<string, unknown>) => void, {
      draggable: config.draggable,
      zoomable: config.zoomable,
      rotatable: config.rotatable,
      tiltable: config.tiltable,
      pinClickable: config.pinClickable,
      showDirections: config.showDirections,
    });
  }, [
    config.draggable,
    config.pinClickable,
    config.rotatable,
    config.showDirections,
    config.tiltable,
    config.zoomable,
    set,
    sync,
  ]);

  return { set };
}
