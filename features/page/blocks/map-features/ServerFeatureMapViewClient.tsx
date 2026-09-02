'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type * as maplibregl from 'maplibre-gl';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Box } from '@mantine/core';
import { MapViewEmbedded } from '@/features/map/MapViewEmbedded';
import type { MapRendererPlace, MapServerFeatureSource } from '@/features/map/types';
import type { MapViewConfig } from '@/lib/types/map/model';
import { useServerClusterDrill, type ClusterDrillTarget } from './server-cluster-drill';
import {
  clampMapViewportToZoomBounds,
  getClusterRadiusPxForZoom,
  getResponsiveMapViewport,
  getViewportHeightForWidth,
  isFullWorldLongitudeBounds,
  stripViewportSearchParams,
  type MapViewportRequest,
} from './viewport';

interface ServerFeatureItem {
  placeId: string;
}

const EMPTY_FEATURE_SOURCE: MapServerFeatureSource = {
  type: 'FeatureCollection',
  features: [],
};

interface ServerFeatureResponse<TItem extends ServerFeatureItem, TCluster extends ClusterDrillTarget> {
  clusters: TCluster[];
  items: TItem[];
}

interface ServerFeatureMapViewClientProps<
  TItem extends ServerFeatureItem,
  TCluster extends ClusterDrillTarget,
  TResponse extends ServerFeatureResponse<TItem, TCluster>,
> {
  sectionId?: string;
  mapViewConfig: MapViewConfig;
  initialViewport: MapViewportRequest;
  initialFeatures?: TResponse;
  requestedLocale?: string;
  queryScope: 'post-map-features' | 'work-map-features';
  queryIdentity: unknown;
  className: string;
  loadFeatures: (viewport: MapViewportRequest) => Promise<TResponse>;
  buildFeatureSource: (response: TResponse) => MapServerFeatureSource;
  buildPlaces: (items: TItem[]) => MapRendererPlace[];
  getItemHref: (item: TItem) => string;
}

function isSameViewport(a: MapViewportRequest, b: MapViewportRequest): boolean {
  return (
    Math.abs(a.bounds.west - b.bounds.west) < 0.00001 &&
    Math.abs(a.bounds.south - b.bounds.south) < 0.00001 &&
    Math.abs(a.bounds.east - b.bounds.east) < 0.00001 &&
    Math.abs(a.bounds.north - b.bounds.north) < 0.00001 &&
    Math.abs(a.zoom - b.zoom) < 0.001 &&
    Math.abs(a.widthPx - b.widthPx) < 1 &&
    Math.abs(a.heightPx - b.heightPx) < 1 &&
    Math.abs(a.clusterRadiusPx - b.clusterRadiusPx) < 1 &&
    Math.abs(a.minClusterPoints - b.minClusterPoints) < 1
  );
}

export function ServerFeatureMapViewClient<
  TItem extends ServerFeatureItem,
  TCluster extends ClusterDrillTarget,
  TResponse extends ServerFeatureResponse<TItem, TCluster>,
>({
  sectionId,
  mapViewConfig,
  initialViewport,
  initialFeatures,
  requestedLocale,
  queryScope,
  queryIdentity,
  className,
  loadFeatures,
  buildFeatureSource,
  buildPlaces,
  getItemHref,
}: ServerFeatureMapViewClientProps<TItem, TCluster, TResponse>) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const initialQueryDataRef = useRef(initialFeatures);
  const boundedInitialViewport = useMemo(
    () => clampMapViewportToZoomBounds(initialViewport, mapViewConfig),
    [initialViewport, mapViewConfig],
  );
  const [viewport, setViewport] = useState<MapViewportRequest>(boundedInitialViewport);
  const [mapCenter, setMapCenter] = useState(mapViewConfig.center);

  useEffect(() => {
    initialQueryDataRef.current = undefined;
  }, []);

  useEffect(() => {
    setViewport((current) => (isSameViewport(current, boundedInitialViewport) ? current : boundedInitialViewport));
  }, [boundedInitialViewport]);

  useEffect(() => {
    setMapCenter(mapViewConfig.center);
  }, [mapViewConfig.center]);

  useLayoutEffect(() => {
    if (!isFullWorldLongitudeBounds(boundedInitialViewport.bounds) || typeof ResizeObserver === 'undefined') {
      return;
    }

    const element = containerRef.current;
    if (!element) {
      return;
    }

    const syncResponsiveViewport = () => {
      const widthPx = Math.round(element.getBoundingClientRect().width);
      if (widthPx <= 0) {
        return;
      }

      const heightPx = getViewportHeightForWidth(widthPx, mapViewConfig.aspectRatio);
      const responsiveViewport = clampMapViewportToZoomBounds(
        getResponsiveMapViewport(boundedInitialViewport, widthPx, heightPx),
        mapViewConfig,
      );

      setViewport((current) =>
        isSameViewport(current, boundedInitialViewport) && !isSameViewport(current, responsiveViewport)
          ? responsiveViewport
          : current,
      );
    };

    syncResponsiveViewport();

    const observer = new ResizeObserver(() => {
      syncResponsiveViewport();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [boundedInitialViewport, mapViewConfig, mapViewConfig.aspectRatio]);

  const featuresQuery = useQuery({
    queryKey: [queryScope, sectionId, queryIdentity, viewport, requestedLocale ?? null],
    queryFn: () => loadFeatures(viewport),
    initialData: initialQueryDataRef.current,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const currentFeatures = featuresQuery.data;
  const featureItems = useMemo<TItem[]>(() => currentFeatures?.items ?? [], [currentFeatures]);
  const featureClusters = useMemo<TCluster[]>(() => currentFeatures?.clusters ?? [], [currentFeatures]);
  const featureSourceData = useMemo(
    () => (currentFeatures ? buildFeatureSource(currentFeatures) : EMPTY_FEATURE_SOURCE),
    [buildFeatureSource, currentFeatures],
  );
  const featurePlaces = useMemo(() => buildPlaces(featureItems), [buildPlaces, featureItems]);
  const clusterById = useMemo(
    () => new Map(featureClusters.map((cluster) => [cluster.id, cluster])),
    [featureClusters],
  );
  const { handleClusterClick } = useServerClusterDrill({
    mapRef,
    clusters: featureClusters,
    isFetching: featuresQuery.isFetching,
    viewportZoom: viewport.zoom,
  });
  const itemById = useMemo(() => new Map(featureItems.map((item) => [item.placeId, item])), [featureItems]);
  const mapConfigForViewport = useMemo(
    () => ({
      ...mapViewConfig,
      center: mapCenter,
      zoom: viewport.zoom,
      places: featurePlaces,
    }),
    [featurePlaces, mapCenter, mapViewConfig, viewport.zoom],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const currentParams = new URLSearchParams(window.location.search);
    const nextParams = stripViewportSearchParams(currentParams);
    const nextQueryString = nextParams.toString();
    const currentQueryString = currentParams.toString();
    if (nextQueryString === currentQueryString) {
      return;
    }

    const nextUrl = nextQueryString
      ? `${window.location.pathname}?${nextQueryString}${window.location.hash}`
      : `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, []);

  if (
    featureSourceData.features.length === 0 &&
    featurePlaces.length === 0 &&
    (featuresQuery.isLoading || featuresQuery.isFetching)
  ) {
    return (
      <Box ref={containerRef} className={className} pos="relative">
        <MapViewEmbedded
          key={`${mapViewConfig.aspectRatio}:${mapViewConfig.previewWidth ?? 100}`}
          config={mapConfigForViewport}
          allowEmpty
          labelLocale={requestedLocale}
        />
      </Box>
    );
  }

  return (
    <Box ref={containerRef} className={className} pos="relative">
      <MapViewEmbedded
        key={`${mapViewConfig.aspectRatio}:${mapViewConfig.previewWidth ?? 100}`}
        config={mapConfigForViewport}
        allowEmpty
        labelLocale={requestedLocale}
        featureSourceData={featureSourceData}
        onMapReady={(map) => {
          mapRef.current = map;
        }}
        onViewportSettled={(nextViewport) => {
          const normalizedViewport: MapViewportRequest = {
            bounds: nextViewport.bounds,
            zoom: nextViewport.zoom,
            widthPx: nextViewport.widthPx,
            heightPx: nextViewport.heightPx,
            clusterRadiusPx: getClusterRadiusPxForZoom(nextViewport.zoom, nextViewport.widthPx),
            minClusterPoints: viewport.minClusterPoints,
          };
          const boundedViewport = clampMapViewportToZoomBounds(normalizedViewport, mapViewConfig);

          if (
            isSameViewport(viewport, boundedInitialViewport) &&
            isFullWorldLongitudeBounds(boundedInitialViewport.bounds)
          ) {
            const responsiveViewport = clampMapViewportToZoomBounds(
              getResponsiveMapViewport(boundedInitialViewport, nextViewport.widthPx, nextViewport.heightPx),
              mapViewConfig,
            );

            setViewport((current) => (isSameViewport(current, responsiveViewport) ? current : responsiveViewport));
            return;
          }

          setViewport((current) => (isSameViewport(current, boundedViewport) ? current : boundedViewport));
          setMapCenter((current) =>
            Math.abs(current.lat - nextViewport.center.lat) < 0.00001 &&
            Math.abs(current.lng - nextViewport.center.lng) < 0.00001
              ? current
              : nextViewport.center,
          );
        }}
        onFeatureClusterClick={(clusterId) => {
          handleClusterClick(clusterById.get(clusterId));
        }}
        onPlaceClick={(place) => {
          const item = itemById.get(place.id);
          if (!item) {
            return;
          }
          router.push(getItemHref(item));
        }}
      />
    </Box>
  );
}
