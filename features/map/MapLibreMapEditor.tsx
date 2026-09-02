'use client';

import { useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { Leva } from 'leva';
import { useTranslations } from 'next-intl';
import { Box, useComputedColorScheme } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { PageLoader } from '@/features/site/PageLoader';
import { useMapLevaControls, type MapThemeListItem } from '@/features/map/MapLevaControls';
import type { MapRendererPlace } from '@/features/map/types';
import type { ResolvedThemeConfig, ThemeSettings, ThemeVariant } from '@/lib/types/map-theme/model';
import type { MapConfig } from '@/lib/types/map/model';
import { buildResolvedThemeConfig, resolveMapLabelVisibility } from '@/lib/utils/map-theme';

const MapLibreMap = dynamic(() => import('@/features/map/MapLibreMap').then((mod) => mod.MapLibreMap), {
  ssr: false,
});

interface MapLibreMapEditorProps {
  places: MapRendererPlace[];
  config: MapConfig;
  onConfigChange: (updates: Partial<MapConfig>) => void;
  height?: string;
  themes?: MapThemeListItem[];
  interactive?: boolean;
  /** Callback to open places management modal */
  onManagePlaces?: () => void;
  resolveTheme?: (
    themeId: string | undefined,
    scheme: 'light' | 'dark',
  ) => Promise<{
    readonly themeId: string;
    readonly scheme: 'light' | 'dark';
    readonly settings: ThemeSettings;
    readonly variant: ThemeVariant;
  }>;
  levaProps?: {
    collapsed?: boolean;
    hidden?: boolean;
    fill?: boolean;
    flat?: boolean;
    floating?: boolean;
  };
}

/**
 * MapLibreMap with integrated Leva controls for editing.
 * Combines the map renderer with configuration controls in a reusable component.
 */
export function MapLibreMapEditor({
  places,
  config,
  onConfigChange,
  height = '100%',
  themes,
  interactive = true,
  onManagePlaces,
  resolveTheme,
  levaProps,
}: MapLibreMapEditorProps) {
  const tMapControls = useTranslations('mapControls');
  const tMapView = useTranslations('mapView');
  const computedColorScheme = useComputedColorScheme('light');
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Resolve theme from themeId
  const effectiveScheme =
    config.preferredScheme === 'auto' ? computedColorScheme : (config.preferredScheme ?? computedColorScheme);

  const {
    data: themeData,
    isLoading: isThemeLoading,
    isError: isThemeError,
  } = useQuery({
    queryKey: ['mapTheme', 'resolve', config.themeId, effectiveScheme],
    queryFn: () => resolveTheme?.(config.themeId, effectiveScheme),
    enabled: Boolean(resolveTheme),
  });

  // Transform action result to ResolvedThemeConfig format
  const themeConfig = useMemo<ResolvedThemeConfig | undefined>(() => {
    if (!themeData) {
      return undefined;
    }
    const { id: _id, scheme: _scheme, ...variant } = themeData.variant;
    return buildResolvedThemeConfig({
      settings: themeData.settings,
      variant,
      scheme: effectiveScheme,
    });
  }, [effectiveScheme, themeData]);

  useMapLevaControls({
    config,
    onConfigChange,
    themes,
    placesCount: places.length,
    onManagePlaces,
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const localizeLevaTitles = () => {
      root.querySelectorAll<HTMLElement>('[title]').forEach((element) => {
        const title = element.getAttribute('title');
        if (!title) {
          return;
        }

        const match = /^Click to copy (.+) value$/.exec(title);
        if (!match) {
          return;
        }

        const localizedTitle = tMapControls('copyValueTitle', {
          label: match[1],
        });

        if (localizedTitle !== title) {
          element.setAttribute('title', localizedTitle);
        }
      });
    };

    localizeLevaTitles();

    const observer = new MutationObserver(() => {
      localizeLevaTitles();
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['title'],
    });

    return () => {
      observer.disconnect();
    };
  }, [tMapControls]);

  const levaComponent = (
    <Leva
      fill={levaProps?.fill ?? true}
      flat={levaProps?.flat ?? true}
      titleBar={{ title: tMapControls('settingsTitle') }}
      collapsed={levaProps?.collapsed ?? true}
      hidden={levaProps?.hidden}
      theme={{
        sizes: { rootWidth: '280px' },
      }}
    />
  );

  if (isThemeLoading) {
    return <PageLoader height={height} minHeight={0} />;
  }

  if (isThemeError || !themeConfig) {
    return (
      <Alert role="alert" tone="danger">
        {tMapView('themeUnavailable')}
      </Alert>
    );
  }

  const showAreaLabels = resolveMapLabelVisibility(config.areaLabelsMode, themeConfig.showAreaLabels);
  const showPoiLabels = resolveMapLabelVisibility(config.poiLabelsMode, themeConfig.showPoiLabels);

  const mapComponent = (
    <MapLibreMap
      places={places}
      center={config.center}
      zoom={config.zoom}
      minZoom={config.minZoom}
      maxZoom={config.maxZoom}
      pitch={config.pitch}
      bearing={config.bearing}
      height={height}
      pinClickable={config.pinClickable}
      draggable={interactive && config.draggable}
      zoomable={interactive && config.zoomable}
      rotatable={interactive && config.rotatable}
      tiltable={interactive && config.tiltable}
      showNavigation={false}
      show3DBuildings={config.show3DBuildings}
      autoRotate={config.autoRotate}
      autoRotateSpeed={config.autoRotateSpeed}
      showDirections={config.showDirections}
      showAreaLabels={showAreaLabels}
      showPoiLabels={showPoiLabels}
      themeConfig={themeConfig}
      onZoomChange={(v) => onConfigChange({ zoom: v })}
      onCenterChange={(v) => onConfigChange({ center: v })}
      onPitchChange={(v) => onConfigChange({ pitch: v })}
      onBearingChange={(v) => onConfigChange({ bearing: v })}
    />
  );

  // Floating mode: Leva positioned absolutely over the map
  if (levaProps?.floating) {
    return (
      <Box h={height} pos="relative" ref={rootRef}>
        <Box
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 100,
            width: 280,
          }}
        >
          {levaComponent}
        </Box>
        {mapComponent}
      </Box>
    );
  }

  // Default mode: Leva rendered separately
  return (
    <Box ref={rootRef}>
      {levaComponent}
      {mapComponent}
    </Box>
  );
}
