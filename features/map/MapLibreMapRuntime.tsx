'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { setWorkerUrl, type Map as MapLibreMapInstance } from 'maplibre-gl';
import MapView, { Layer, Marker, NavigationControl, Source } from 'react-map-gl/maplibre';
import { useComputedColorScheme } from '@mantine/core';

import 'maplibre-gl/dist/maplibre-gl.css';

import type { CalloutField } from '@/lib/types/map-theme/model';
import { clampMapZoom, normalizeMapZoomBounds } from '@/lib/types/map/model';
import { MAP_CLUSTER_DEFAULT_RADIUS_PX, MAP_CLUSTER_MAX_ZOOM } from '@/lib/utils/map-cluster';
import {
  useCalloutDirection,
  useMap3DBuildings,
  useMapAutoRotate,
  useMapControl,
  useMapInteractions,
  useMapLabels,
  useMapPrintCapture,
  useScreenSpaceCluster,
  type MapLoadingStage,
} from './hooks';
import { buildCalloutViewModel } from './callout-model';
import { buildClusterLayerModel } from './cluster-layer-model';
import { configureMapLibreWorker } from './maplibre-worker';
import type { MapLibreMapProps } from './MapLibreMap.types';
import type { MapRendererPlace, MapServerFeatureSource } from './types';
import { MapCalloutView, MapLibreMapView, type MapCalloutColors, type MapCalloutLayout } from './ui';
import {
  buildMapLibreStyle,
  getClusterLayerSizing,
  getMapInteractionOptions,
  MAP_LINK_PROVIDERS,
  openMapProviderLink,
  shouldBlockMapKeyboardEvent,
  syncTouchZoomRotateRotation,
} from './utils';
import { DIRECTIONS_BACKDROP_Z_INDEX, DIRECTIONS_MODAL_Z_INDEX, getPlaceMarkerZIndex } from './utils/hover-order';
import type { BaseMapStyleConfig } from './utils/style-builder';

configureMapLibreWorker(setWorkerUrl);

interface MapLibreMapRuntimeLabels {
  map: string;
  markerAccessibilityLabels: Record<string, string>;
  zoomIn: string;
  zoomOut: string;
  resetNorth: string;
  directions: string;
  printPreview: string;
}

interface MapLibreMapRuntimeProps extends MapLibreMapProps {
  labels: MapLibreMapRuntimeLabels;
  isReady: boolean;
  loadingSurface: ReactNode;
  onLoadingStageChange: (stage: MapLoadingStage) => void;
}

const EMPTY_FEATURE_SOURCE: MapServerFeatureSource = {
  type: 'FeatureCollection',
  features: [],
};

interface ClusterColors {
  color: string;
  hoverColor: string;
  textColor: string;
  textHoverColor: string;
}

interface RuntimeCalloutLayout extends MapCalloutLayout {
  fields: CalloutField[];
}

type ZoomCenterBehavior = 'preserve-center' | 'preserve-pointer';
type CenterChangeBehavior = 'persist' | 'preserve-logical-center';

function getZoomCenterBehavior({
  draggable,
  originalEvent,
}: {
  draggable: boolean;
  originalEvent: MouseEvent | TouchEvent | WheelEvent | undefined;
}): ZoomCenterBehavior {
  if (!draggable) {
    return 'preserve-center';
  }

  if (typeof WheelEvent !== 'undefined' && originalEvent instanceof WheelEvent) {
    return 'preserve-pointer';
  }

  if (typeof TouchEvent !== 'undefined' && originalEvent instanceof TouchEvent) {
    return 'preserve-pointer';
  }

  if (typeof MouseEvent !== 'undefined' && originalEvent instanceof MouseEvent) {
    const target = originalEvent.target;
    if (target instanceof Element) {
      if (target.closest('.maplibregl-ctrl-zoom-in, .maplibregl-ctrl-zoom-out')) {
        return 'preserve-center';
      }
    }
  }

  return 'preserve-pointer';
}

export function MapLibreMapRuntime({
  places,
  center,
  zoom,
  minZoom,
  maxZoom,
  clusterRadius,
  clusterMaxZoom,
  labelLocale,
  height = '100%',
  onPlaceClick,
  featureSourceData,
  onFeatureClusterClick,
  onViewportSettled,
  pinClickable = true,
  draggable = true,
  zoomable = true,
  rotatable = false,
  tiltable = false,
  onZoomChange,
  onCenterChange,
  onPitchChange,
  onBearingChange,
  pitch = 0,
  bearing = 0,
  show3DBuildings = false,
  autoRotate = false,
  autoRotateSpeed = 1,
  showDirections = true,
  showAreaLabels,
  showPoiLabels,
  zoomPosition = 'top-left',
  zIndex,
  themeConfig,
  showNavigation,
  instantTransitions = false,
  onMapReady,
  mapStyleOverride,
  cluster = false,
  labels,
  isReady,
  loadingSurface,
  onLoadingStageChange,
}: MapLibreMapRuntimeProps) {
  const colorScheme = useComputedColorScheme('light');
  const mapRef = useRef<MapLibreMapInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const calloutHoveringRef = useRef(false);
  const clusterIdBase = useId().replace(/:/g, '');
  const clusterSourceId = `${clusterIdBase}-places`;
  const clusterHaloLayerId = `${clusterIdBase}-cluster-halo`;
  const clusterCountLayerId = `${clusterIdBase}-cluster-count`;
  const hoveredClusterHaloLayerId = `${clusterIdBase}-cluster-halo-hovered`;
  const unclusteredLayerId = `${clusterIdBase}-unclustered`;
  const effectiveClusterRadius = clusterRadius ?? MAP_CLUSTER_DEFAULT_RADIUS_PX;
  const effectiveClusterMaxZoom = clusterMaxZoom ?? MAP_CLUSTER_MAX_ZOOM;
  const zoomBounds = useMemo(
    () =>
      normalizeMapZoomBounds({
        minZoom,
        maxZoom,
      }),
    [maxZoom, minZoom],
  );
  const effectiveZoom = useMemo(() => clampMapZoom(zoom, zoomBounds), [zoom, zoomBounds]);
  const hasExternalFeatureSource = Boolean(featureSourceData);
  const resolvedShowAreaLabels = showAreaLabels ?? themeConfig.showAreaLabels;
  const resolvedShowPoiLabels = showPoiLabels ?? themeConfig.showPoiLabels;
  const clusterLayerIds = useMemo(
    () => [clusterHaloLayerId, clusterCountLayerId, hoveredClusterHaloLayerId],
    [clusterCountLayerId, clusterHaloLayerId, hoveredClusterHaloLayerId],
  );
  const interactiveLayerIds = useMemo(
    () => (hasExternalFeatureSource ? [...clusterLayerIds, unclusteredLayerId] : clusterLayerIds),
    [clusterLayerIds, hasExternalFeatureSource, unclusteredLayerId],
  );
  const labelBeforeLayerIds = useMemo(
    () => [clusterHaloLayerId, clusterCountLayerId, unclusteredLayerId],
    [clusterCountLayerId, clusterHaloLayerId, unclusteredLayerId],
  );
  const labelThemeConfig = useMemo(
    () => ({ labelTextColor: themeConfig.labelTextColor }),
    [themeConfig.labelTextColor],
  );
  const buildingThemeConfig = useMemo(
    () => ({ buildingFillColor: themeConfig.buildingFillColor }),
    [themeConfig.buildingFillColor],
  );

  const emitViewportSettled = useCallback(() => {
    if (!onViewportSettled || !mapRef.current) {
      return;
    }

    const map = mapRef.current;
    const bounds = map.getBounds();
    const container = map.getContainer();
    onViewportSettled({
      bounds: {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      },
      center: { lat: map.getCenter().lat, lng: map.getCenter().lng },
      zoom: map.getZoom(),
      widthPx: container.clientWidth,
      heightPx: container.clientHeight,
    });
  }, [onViewportSettled]);

  // Provider chooser popup state
  const [selectedPlace, setSelectedPlace] = useState<MapRendererPlace | null>(null);
  const printImageUrl = useMapPrintCapture({ mapRef, containerRef, isReady });
  const zoomCenterBehaviorRef = useRef<ZoomCenterBehavior>(draggable ? 'preserve-pointer' : 'preserve-center');
  const centerChangeBehaviorRef = useRef<CenterChangeBehavior>(draggable ? 'persist' : 'preserve-logical-center');

  const clientClusterSnapshot = useScreenSpaceCluster({
    mapRef,
    enabled: cluster && !hasExternalFeatureSource,
    isReady,
    places,
    clusterRadiusPx: effectiveClusterRadius,
    clusterMaxZoom: effectiveClusterMaxZoom,
  });
  const renderClusterSource = hasExternalFeatureSource || clientClusterSnapshot.enabled;
  const {
    interactionPriorityMode,
    hoveredClusterKey,
    activeClusterKey,
    hoveredPlaceId,
    activePlaceId,
    setActiveClusterKey,
    setActivePlaceId,
    setCanvasCursor,
    handleClusteredMapClick,
    handleClusteredMapHover,
    handleClusteredMapLeave,
    handleMarkerHover,
    handleMarkerClick,
  } = useMapInteractions({
    mapRef,
    draggable,
    places,
    selectedPlace,
    setSelectedPlace,
    clusterLayerIds,
    unclusteredLayerId,
    hasExternalFeatureSource,
    clientClusters: clientClusterSnapshot.clusters,
    maxZoom: zoomBounds.maxZoom,
    instantTransitions,
    showDirections,
    onFeatureClusterClick,
    onPlaceClick,
  });

  useEffect(() => {
    zoomCenterBehaviorRef.current = draggable ? 'preserve-pointer' : 'preserve-center';
    centerChangeBehaviorRef.current = draggable ? 'persist' : 'preserve-logical-center';
  }, [draggable]);

  useEffect(() => {
    const container = mapRef.current?.getContainer();
    if (!container) {
      return;
    }

    container.setAttribute('aria-label', labels.map);
    container
      .querySelector<HTMLElement>('canvas.maplibregl-canvas[role="region"]')
      ?.setAttribute('aria-label', labels.map);

    container.querySelectorAll<HTMLElement>('.maplibregl-marker').forEach((markerElement) => {
      const placeId = markerElement
        .querySelector<HTMLElement>('.mgl-callout[data-place-id]')
        ?.getAttribute('data-place-id');
      const markerLabel = placeId ? labels.markerAccessibilityLabels[placeId] : null;

      if (markerLabel) {
        markerElement.setAttribute('aria-label', markerLabel);
      }
    });

    const setControlLabel = (selector: string, label: string) => {
      const element = container.querySelector<HTMLElement>(selector);
      if (!element) {
        return;
      }
      element.setAttribute('aria-label', label);
      element.setAttribute('title', label);
    };

    setControlLabel('.maplibregl-ctrl-zoom-in', labels.zoomIn);
    setControlLabel('.maplibregl-ctrl-zoom-out', labels.zoomOut);
    setControlLabel('.maplibregl-ctrl-compass', labels.resetNorth);
  }, [isReady, labels, places]);

  const {
    userInteractingRef,
    handleInteractionStart,
    handleInteractionEnd,
    handleMoveEnd,
    handleZoomEnd,
    handlePitchEnd,
    handleRotateEnd,
  } = useMapControl({
    mapRef,
    isReady,
    center,
    zoom: effectiveZoom,
    pitch,
    bearing,
    instantTransitions,
    onCenterChange,
    onZoomChange,
    onPitchChange,
    onBearingChange,
  });

  const { containerWidth, getPlacement } = useCalloutDirection({
    mapRef,
    places,
    isReady,
  });

  useMapLabels({
    mapRef,
    isReady,
    showAreaLabels: resolvedShowAreaLabels,
    showPoiLabels: resolvedShowPoiLabels,
    labelLocale,
    themeConfig: labelThemeConfig,
    colorScheme,
    beforeLayerIds: labelBeforeLayerIds,
  });

  useMap3DBuildings({
    mapRef,
    isReady,
    enabled: show3DBuildings,
    themeConfig: buildingThemeConfig,
    colorScheme,
  });

  useMapAutoRotate({
    mapRef,
    isReady,
    enabled: autoRotate,
    speed: autoRotateSpeed,
    pitch,
    userInteractingRef,
    pauseRef: calloutHoveringRef,
  });

  const baseMapStyleConfig = useMemo<BaseMapStyleConfig>(
    () => ({
      backgroundColor: themeConfig.backgroundColor,
      waterColor: themeConfig.waterColor,
      landColor: themeConfig.landColor,
      roadColor: themeConfig.roadColor,
      buildingFillColor: themeConfig.buildingFillColor,
      buildingStrokeEnabled: themeConfig.buildingStrokeEnabled,
      buildingStrokeColor: themeConfig.buildingStrokeColor,
    }),
    [
      themeConfig.backgroundColor,
      themeConfig.waterColor,
      themeConfig.landColor,
      themeConfig.roadColor,
      themeConfig.buildingFillColor,
      themeConfig.buildingStrokeEnabled,
      themeConfig.buildingStrokeColor,
    ],
  );

  const mapStyle = useMemo(() => {
    if (mapStyleOverride) {
      return mapStyleOverride;
    }
    return buildMapLibreStyle(baseMapStyleConfig);
  }, [baseMapStyleConfig, mapStyleOverride]);

  const calloutColors = useMemo<MapCalloutColors>(() => {
    return {
      lineColor: themeConfig.calloutLineColor,
      hoverLineColor: themeConfig.calloutHoverLineColor,
      textColor: themeConfig.calloutTextColor,
      hoverTextColor: themeConfig.calloutHoverTextColor,
      descriptionColor: themeConfig.calloutDescriptionColor,
      hoverDescriptionColor: themeConfig.calloutHoverDescriptionColor,
      backgroundColor: themeConfig.calloutBackgroundColor,
      hoverBackgroundColor: themeConfig.calloutHoverBackgroundColor,
    };
  }, [themeConfig]);

  const clusterColors = useMemo<ClusterColors>(() => {
    return {
      color: themeConfig.clusterColor,
      hoverColor: themeConfig.clusterHoverColor,
      textColor: themeConfig.clusterTextColor,
      textHoverColor: themeConfig.clusterTextHoverColor,
    };
  }, [themeConfig]);

  const calloutLayout = useMemo<RuntimeCalloutLayout>(
    () => ({
      scale: themeConfig.calloutScale,
      offsetX: themeConfig.calloutOffsetX,
      offsetY: themeConfig.calloutOffsetY,
      fields: themeConfig.calloutFields,
    }),
    [themeConfig],
  );
  const clusterLayerSizing = useMemo(() => getClusterLayerSizing(containerWidth), [containerWidth]);
  const interactionOptions = useMemo(
    () =>
      getMapInteractionOptions({
        draggable,
        zoomable,
        rotatable,
        tiltable,
      }),
    [draggable, rotatable, tiltable, zoomable],
  );

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    syncTouchZoomRotateRotation(mapRef.current.touchZoomRotate, {
      rotatable,
      zoomable,
    });
  }, [rotatable, zoomable]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !interactionOptions.keyboard) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLCanvasElement) || !target.classList.contains('maplibregl-canvas')) {
        return;
      }

      if (
        shouldBlockMapKeyboardEvent(event, {
          draggable,
          zoomable,
          rotatable,
          tiltable,
        })
      ) {
        event.stopPropagation();
      }
    };

    container.addEventListener('keydown', handleKeyDown, true);
    return () => {
      container.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [draggable, interactionOptions.keyboard, rotatable, tiltable, zoomable]);

  const clientSingletonPlaceIdSet = useMemo(
    () => new Set(clientClusterSnapshot.singletonPlaceIds),
    [clientClusterSnapshot.singletonPlaceIds],
  );
  const markerPlaces = useMemo(() => {
    if (hasExternalFeatureSource || !renderClusterSource) {
      return places;
    }

    return places.filter((place) => clientSingletonPlaceIdSet.has(place.id));
  }, [clientSingletonPlaceIdSet, hasExternalFeatureSource, places, renderClusterSource]);
  const renderPlaceMarkers = markerPlaces.length > 0;
  const sourceData = featureSourceData ?? clientClusterSnapshot.featureSourceData ?? EMPTY_FEATURE_SOURCE;
  const { haloLayer, hoveredHaloLayer, countLayer, unclusteredLayer } = useMemo(
    () =>
      buildClusterLayerModel({
        sourceId: clusterSourceId,
        haloLayerId: clusterHaloLayerId,
        hoveredHaloLayerId: hoveredClusterHaloLayerId,
        countLayerId: clusterCountLayerId,
        unclusteredLayerId,
        colors: clusterColors,
        sizing: clusterLayerSizing,
        priorityMode: interactionPriorityMode,
        hoveredKey: hoveredClusterKey,
        activeKey: activeClusterKey,
      }),
    [
      activeClusterKey,
      clusterColors,
      clusterCountLayerId,
      clusterHaloLayerId,
      clusterLayerSizing,
      clusterSourceId,
      hoveredClusterHaloLayerId,
      hoveredClusterKey,
      interactionPriorityMode,
      unclusteredLayerId,
    ],
  );

  const bgColor = themeConfig.backgroundColor;
  const containerClassName =
    [!draggable ? 'mgl-not-draggable' : null, printImageUrl ? 'mgl-print-ready' : null].filter(Boolean).join(' ') ||
    undefined;
  const calloutViewModelsById = useMemo(
    () => new globalThis.Map(places.map((place) => [place.id, buildCalloutViewModel(place, calloutLayout.fields)])),
    [calloutLayout.fields, places],
  );
  const directions = useMemo(
    () =>
      showDirections && selectedPlace
        ? {
            title: labels.directions,
            options: MAP_LINK_PROVIDERS.map((provider) => ({
              id: provider.id,
              label: provider.label,
              icon: provider.id,
            })),
          }
        : null,
    [labels.directions, selectedPlace, showDirections],
  );
  const handleSelectProvider = useCallback(
    (providerId: string) => {
      if (!selectedPlace) {
        return;
      }

      const provider = MAP_LINK_PROVIDERS.find((candidate) => candidate.id === providerId);
      if (provider) {
        openMapProviderLink(provider.buildPlaceLink(selectedPlace));
      }
    },
    [selectedPlace],
  );

  return (
    <MapLibreMapView
      height={height}
      zIndex={zIndex}
      className={containerClassName}
      backgroundColor={bgColor}
      containerRef={containerRef}
      mapSurface={
        <MapView
          ref={(ref) => {
            mapRef.current = ref?.getMap() ?? null;
          }}
          initialViewState={{
            longitude: center.lng,
            latitude: center.lat,
            zoom: effectiveZoom,
            pitch,
            bearing,
          }}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: bgColor,
            opacity: isReady ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
          mapStyle={mapStyle}
          onLoad={(event) => {
            const map = event.target;
            mapRef.current = map;
            onLoadingStageChange('rendering');
            syncTouchZoomRotateRotation(map.touchZoomRotate, { rotatable, zoomable });
            setCanvasCursor(null);
            map.once('idle', () => {
              onLoadingStageChange('ready');
              emitViewportSettled();
            });
            onMapReady?.(map);
          }}
          onMoveStart={(e) => {
            if (e.originalEvent) {
              handleInteractionStart();
            }
            if (e.originalEvent && interactionPriorityMode === 'active') {
              setActiveClusterKey(null);
              setActivePlaceId((current) => selectedPlace?.id ?? current);
            }
            if (e.originalEvent && draggable) {
              setCanvasCursor('grabbing');
            }
          }}
          onMoveEnd={(e) => {
            const isUser = !!e.originalEvent;
            handleMoveEnd(isUser, centerChangeBehaviorRef.current === 'persist');
            if (isUser) {
              handleInteractionEnd();
            }
            centerChangeBehaviorRef.current = draggable ? 'persist' : 'preserve-logical-center';
            setCanvasCursor(null);
            emitViewportSettled();
          }}
          onDragStart={() => {
            centerChangeBehaviorRef.current = 'persist';
          }}
          onZoomStart={(e) => {
            if (e.originalEvent) {
              handleInteractionStart();
            }
            const zoomCenterBehavior = getZoomCenterBehavior({
              draggable,
              originalEvent: e.originalEvent,
            });
            zoomCenterBehaviorRef.current = zoomCenterBehavior;
            centerChangeBehaviorRef.current =
              zoomCenterBehavior === 'preserve-center' ? 'preserve-logical-center' : 'persist';
          }}
          onZoomEnd={(e) => handleZoomEnd(!!e.originalEvent, zoomCenterBehaviorRef.current === 'preserve-center')}
          onPitchStart={(e) => {
            if (e.originalEvent) {
              handleInteractionStart();
            }
          }}
          onPitchEnd={
            onPitchChange
              ? (e) => {
                  handlePitchEnd(!!e.originalEvent);
                  if (e.originalEvent) {
                    handleInteractionEnd();
                  }
                }
              : undefined
          }
          onRotateStart={(e) => {
            if (e.originalEvent) {
              handleInteractionStart();
            }
          }}
          onRotateEnd={
            onBearingChange
              ? (e) => {
                  handleRotateEnd(!!e.originalEvent);
                  if (e.originalEvent) {
                    handleInteractionEnd();
                  }
                }
              : undefined
          }
          dragPan={draggable}
          scrollZoom={interactionOptions.scrollZoom}
          touchZoomRotate={interactionOptions.touchZoomRotate}
          doubleClickZoom={interactionOptions.doubleClickZoom}
          keyboard={interactionOptions.keyboard}
          dragRotate={rotatable}
          touchPitch={tiltable}
          pitchWithRotate={tiltable}
          minZoom={zoomBounds.minZoom}
          maxZoom={zoomBounds.maxZoom}
          maxPitch={85}
          canvasContextAttributes={{ preserveDrawingBuffer: true }}
          attributionControl={false}
          renderWorldCopies={false}
          interactiveLayerIds={renderClusterSource ? interactiveLayerIds : undefined}
          onClick={renderClusterSource ? handleClusteredMapClick : undefined}
          onMouseMove={renderClusterSource ? handleClusteredMapHover : undefined}
          onMouseLeave={renderClusterSource ? handleClusteredMapLeave : undefined}
        >
          {(showNavigation ?? zoomable) && <NavigationControl position={zoomPosition} />}

          {renderClusterSource ? (
            <Source id={clusterSourceId} type="geojson" data={sourceData}>
              <Layer {...haloLayer} />
              <Layer {...hoveredHaloLayer} />
              <Layer {...countLayer} />
              {hasExternalFeatureSource ? <Layer {...unclusteredLayer} /> : null}
            </Source>
          ) : null}

          {renderPlaceMarkers &&
            markerPlaces.map((place, index) => {
              const placement = getPlacement(place.id, index);
              const isSelected = selectedPlace?.id === place.id;
              return (
                <Marker
                  key={place.id}
                  longitude={place.lng}
                  latitude={place.lat}
                  anchor="center"
                  subpixelPositioning
                  style={{
                    zIndex: getPlaceMarkerZIndex({
                      mode: interactionPriorityMode,
                      index,
                      hovered: interactionPriorityMode === 'hover' && hoveredPlaceId === place.id,
                      active: interactionPriorityMode === 'active' && activePlaceId === place.id,
                      selected: isSelected,
                    }),
                  }}
                >
                  <MapCalloutView
                    callout={calloutViewModelsById.get(place.id)!}
                    direction={placement.direction}
                    stackOffsetY={placement.stackOffsetY}
                    colors={calloutColors}
                    layout={calloutLayout}
                    containerWidth={containerWidth}
                    clickable={pinClickable && (showDirections || !!onPlaceClick)}
                    onHoverChange={(hovered) => {
                      calloutHoveringRef.current = hovered;
                      handleMarkerHover(place.id, hovered);
                    }}
                    onClick={() => handleMarkerClick(place)}
                  />
                </Marker>
              );
            })}
        </MapView>
      }
      isReady={isReady}
      loadingSurface={loadingSurface}
      attributionItems={[
        { label: '© OpenMapTiles', href: 'https://openmaptiles.org' },
        {
          label: '© OpenStreetMap contributors',
          href: 'https://www.openstreetmap.org/copyright',
        },
      ]}
      attributionColor={themeConfig.attributionColor}
      attributionFontSize={themeConfig.attributionFontSize}
      directions={directions}
      onCloseDirections={() => {
        setSelectedPlace(null);
        setActivePlaceId(null);
      }}
      onSelectProvider={handleSelectProvider}
      backdropZIndex={DIRECTIONS_BACKDROP_Z_INDEX}
      modalZIndex={DIRECTIONS_MODAL_Z_INDEX}
      printImageUrl={printImageUrl}
      printPreviewAlt={labels.printPreview}
    />
  );
}
