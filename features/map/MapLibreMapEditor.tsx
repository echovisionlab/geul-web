'use client';

import { useComputedColorScheme } from '@/lib/providers/DesignSystemProvider';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { ParameterPanel } from '@/components/core/ParameterPanel';
import { useTranslations } from 'next-intl';

import { Alert } from '@/components/core/Alert';
import { PageLoader } from '@/features/site/PageLoader';
import { useMapParameterControls, type MapThemeListItem } from '@/features/map/MapParameterControls';
import type { MapRendererPlace } from '@/features/map/types';
import type { ResolvedThemeConfig, ThemeSettings, ThemeVariant } from '@/lib/types/map-theme/model';
import type { MapConfig } from '@/lib/types/map/model';
import { buildResolvedThemeConfig, resolveMapLabelVisibility } from '@/lib/utils/map-theme';

const MapLibreMap = dynamic(() => import('@/features/map/MapLibreMap').then((mod) => mod.MapLibreMap), {
  ssr: false,
  loading: () => <MapEditorLoader />,
});

function MapEditorLoader() {
  const t = useTranslations('mapView');
  return <PageLoader extent="container" message={t('loading')} />;
}

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
  /** Places or themes for the first render are loading; the map keeps its frame and shows its loader. */
  dataPending?: boolean;
  settingsPanel?: {
    collapsed?: boolean;
    hidden?: boolean;
    placement?: 'inline' | 'map-corner';
  };
}

/**
 * MapLibreMap with integrated controlled parameter inputs for editing.
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
  settingsPanel,
  dataPending = false,
}: MapLibreMapEditorProps) {
  const tMapControls = useTranslations('mapControls');
  const tMapView = useTranslations('mapView');
  const computedColorScheme = useComputedColorScheme();

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

  const { model } = useMapParameterControls({
    config,
    onConfigChange,
    themes,
    placesCount: places.length,
    onManagePlaces,
  });

  if (isThemeLoading) {
    return (
      <div style={{ height, position: 'relative' }} aria-busy="true">
        <MapEditorLoader />
      </div>
    );
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
      dataPending={dataPending}
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

  return (
    <div style={{ height, position: 'relative' }}>
      {!settingsPanel?.hidden && (
        <ParameterPanel
          title={tMapControls('settingsTitle')}
          model={model}
          defaultCollapsed={settingsPanel?.collapsed ?? true}
          placement={settingsPanel?.placement ?? 'inline'}
          copyLabel={(label) => tMapControls('copyValueTitle', { label })}
        />
      )}
      {mapComponent}
    </div>
  );
}
