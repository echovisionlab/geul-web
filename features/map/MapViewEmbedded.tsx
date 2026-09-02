'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import type * as maplibregl from 'maplibre-gl';
import { useTranslations } from 'next-intl';
import { useComputedColorScheme } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import type { MapRendererProps, MapServerFeatureSource, MapViewportSnapshot } from '@/features/map/types';
import { PageLoader } from '@/features/site/PageLoader';
import { useResolvedMapThemeConfig } from '@/hooks/useResolvedMapThemeConfig';
import { normalizeLocale } from '@/lib/i18n/locale';
import { useLocale } from '@/lib/providers/LocaleProvider';
import type { ResolvedThemeConfig } from '@/lib/types/map-theme/model';
import type { MapViewConfig } from '@/lib/types/map/model';
import { resolveMapLabelVisibility } from '@/lib/utils/map-theme';
import { resolveMapEmbeddedContainerStyle } from './embedded-layout';

function MapEmbeddedLoader() {
  const t = useTranslations('mapView');

  return <PageLoader height="100%" minHeight={0} message={t('loading')} />;
}

// Dynamic import for MapLibreMap (requires window)
const MapLibreMap = dynamic(() => import('@/features/map/MapLibreMap').then((mod) => mod.MapLibreMap), {
  ssr: false,
  loading: () => <MapEmbeddedLoader />,
});

interface MapViewEmbeddedProps {
  config: MapViewConfig;
  /** Apply preview width from config (percentage). Disable when parent already controls width. */
  applyPreviewWidth?: boolean;
  /** Optional alignment for the preview-width container. */
  blockAlignment?: string;
  allowEmpty?: boolean;
  labelLocale?: string | null;
  onPlaceClick?: (place: MapRendererProps['places'][number]) => void;
  featureSourceData?: MapServerFeatureSource;
  onFeatureClusterClick?: (featureId: string) => void;
  onViewportSettled?: (viewport: MapViewportSnapshot) => void;
  onMapReady?: (map: maplibregl.Map) => void;
  caption?: ReactNode;
}

/**
 * MapViewEmbedded renders a map with fully embedded data.
 * No additional tRPC fetches required - all place and theme data is embedded in config.
 */
export function MapViewEmbedded({
  config,
  applyPreviewWidth = true,
  blockAlignment,
  allowEmpty = false,
  labelLocale,
  onPlaceClick,
  featureSourceData,
  onFeatureClusterClick,
  onViewportSettled,
  onMapReady,
  caption,
}: MapViewEmbeddedProps) {
  const t = useTranslations('mapView');
  const computedColorScheme = useComputedColorScheme('light');
  const currentLocale = useLocale();
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleChange = (event?: MediaQueryListEvent) => {
      setIsMobileViewport(event ? event.matches : mediaQuery.matches);
    };

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Determine effective color scheme
  const effectiveScheme = config.preferredScheme === 'auto' ? computedColorScheme : config.preferredScheme;

  const themeResolution = useResolvedMapThemeConfig({
    theme: config.theme,
    scheme: effectiveScheme,
  });
  const themeConfig = themeResolution.config;
  const resolvedLabelLocale = normalizeLocale(labelLocale) ?? currentLocale;

  // Convert MapViewPlace[] to MapRendererPlace[] format
  const rendererPlaces = useMemo<MapRendererProps['places']>(
    () =>
      config.places.map((place) => ({
        id: place.id,
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        addressComponents: place.addressComponents ?? undefined,
      })),
    [config.places],
  );

  const previewWidthPercent =
    typeof config.previewWidth === 'number' && Number.isFinite(config.previewWidth)
      ? Math.max(10, Math.min(100, config.previewWidth))
      : 100;

  const containerStyle = resolveMapEmbeddedContainerStyle({
    previewWidth: previewWidthPercent,
    blockAlignment,
    applyPreviewWidth,
    isMobileViewport,
  });

  if (!allowEmpty && config.places.length === 0 && (!featureSourceData || featureSourceData.features.length === 0)) {
    return null;
  }

  if (themeResolution.isLoading) {
    return <MapEmbeddedLoader />;
  }

  if (themeResolution.isError || !themeConfig) {
    return (
      <Alert role="alert" tone="danger">
        {t('themeUnavailable')}
      </Alert>
    );
  }

  const showAreaLabels = resolveMapLabelVisibility(config.areaLabelsMode, themeConfig.showAreaLabels);
  const showPoiLabels = resolveMapLabelVisibility(config.poiLabelsMode, themeConfig.showPoiLabels);

  return (
    <div style={containerStyle}>
      <MapLibreMapView
        places={rendererPlaces}
        config={config}
        themeConfig={themeConfig}
        showAreaLabels={showAreaLabels}
        showPoiLabels={showPoiLabels}
        labelLocale={resolvedLabelLocale}
        onPlaceClick={onPlaceClick}
        featureSourceData={featureSourceData}
        onFeatureClusterClick={onFeatureClusterClick}
        onViewportSettled={onViewportSettled}
        onMapReady={onMapReady}
      />
      {caption}
    </div>
  );
}

interface MapLibreMapViewProps {
  places: MapRendererProps['places'];
  config: MapViewConfig;
  themeConfig: ResolvedThemeConfig;
  showAreaLabels: boolean;
  showPoiLabels: boolean;
  labelLocale: string;
  onPlaceClick?: (place: MapRendererProps['places'][number]) => void;
  featureSourceData?: MapServerFeatureSource;
  onFeatureClusterClick?: (featureId: string) => void;
  onViewportSettled?: (viewport: MapViewportSnapshot) => void;
  onMapReady?: (map: maplibregl.Map) => void;
}

function getAspectRatioValue(ratio: string): string {
  switch (ratio) {
    case '16:9':
      return '16 / 9';
    case '4:3':
      return '4 / 3';
    case '1:1':
      return '1 / 1';
    default:
      return '16 / 9';
  }
}

function MapLibreMapView({
  places,
  config,
  themeConfig,
  showAreaLabels,
  showPoiLabels,
  labelLocale,
  onPlaceClick,
  featureSourceData,
  onFeatureClusterClick,
  onViewportSettled,
  onMapReady,
}: MapLibreMapViewProps) {
  const containerStyle: React.CSSProperties = {
    width: '100%',
    aspectRatio: getAspectRatioValue(config.aspectRatio),
    maxHeight: '70dvh',
    overflow: 'hidden',
    position: 'relative',
  };

  return (
    <div style={containerStyle}>
      <MapLibreMap
        places={places}
        center={config.center}
        zoom={config.zoom}
        minZoom={config.minZoom}
        maxZoom={config.maxZoom}
        cluster={config.cluster}
        pinClickable={config.pinClickable}
        pitch={config.pitch}
        bearing={config.bearing}
        draggable={config.draggable}
        zoomable={config.zoomable}
        rotatable={config.rotatable}
        tiltable={config.tiltable}
        show3DBuildings={config.show3DBuildings}
        autoRotate={config.autoRotate}
        autoRotateSpeed={config.autoRotateSpeed}
        showDirections={config.showDirections}
        showNavigation={false}
        themeConfig={themeConfig}
        showAreaLabels={showAreaLabels}
        showPoiLabels={showPoiLabels}
        labelLocale={labelLocale}
        onPlaceClick={onPlaceClick}
        featureSourceData={featureSourceData}
        onFeatureClusterClick={onFeatureClusterClick}
        onViewportSettled={onViewportSettled}
        onMapReady={onMapReady}
      />
    </div>
  );
}
