import { useCallback, useEffect, useMemo, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { MapRendererPlace } from '../types';
import type { ScreenSpaceClusterGroup } from '../utils';
import type { InteractionPriorityMode } from '../utils/hover-order';

interface ClusterFeatureProperties {
  id?: string;
}

interface ClusterPointerEvent {
  features?: Array<{
    layer?: { id?: string };
    properties?: ClusterFeatureProperties;
  }>;
}

interface UseMapInteractionsOptions {
  mapRef: RefObject<maplibregl.Map | null>;
  draggable: boolean;
  places: MapRendererPlace[];
  selectedPlace: MapRendererPlace | null;
  setSelectedPlace: Dispatch<SetStateAction<MapRendererPlace | null>>;
  clusterLayerIds: string[];
  unclusteredLayerId: string;
  hasExternalFeatureSource: boolean;
  clientClusters: ScreenSpaceClusterGroup[];
  maxZoom: number;
  instantTransitions: boolean;
  showDirections: boolean;
  onFeatureClusterClick?: (clusterId: string) => void;
  onPlaceClick?: (place: MapRendererPlace) => void;
}

function getInitialInteractionPriorityMode(): InteractionPriorityMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'hover';
  }
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches ? 'hover' : 'active';
}

export function useMapInteractions({
  mapRef,
  draggable,
  places,
  selectedPlace,
  setSelectedPlace,
  clusterLayerIds,
  unclusteredLayerId,
  hasExternalFeatureSource,
  clientClusters,
  maxZoom,
  instantTransitions,
  showDirections,
  onFeatureClusterClick,
  onPlaceClick,
}: UseMapInteractionsOptions) {
  const [interactionPriorityMode, setInteractionPriorityMode] = useState<InteractionPriorityMode>(
    getInitialInteractionPriorityMode,
  );
  const [hoveredClusterKey, setHoveredClusterKey] = useState<string | number | null>(null);
  const [activeClusterKey, setActiveClusterKey] = useState<string | number | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const placeById = useMemo(() => new Map(places.map((place) => [place.id, place])), [places]);
  const clientClusterById = useMemo(
    () => new Map(clientClusters.map((cluster) => [cluster.id, cluster])),
    [clientClusters],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const handleChange = (event?: MediaQueryListEvent) => {
      setInteractionPriorityMode((event?.matches ?? mediaQuery.matches) ? 'hover' : 'active');
    };
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (interactionPriorityMode === 'hover') {
      setActiveClusterKey(null);
      setActivePlaceId(null);
      return;
    }
    setHoveredClusterKey(null);
    setHoveredPlaceId(null);
  }, [interactionPriorityMode]);

  useEffect(() => {
    if (interactionPriorityMode === 'active' && selectedPlace) {
      setActivePlaceId(selectedPlace.id);
    }
  }, [interactionPriorityMode, selectedPlace]);

  const setCanvasCursor = useCallback(
    (cursor: string | null) => {
      const canvas = mapRef.current?.getCanvas();
      if (canvas) {
        canvas.style.cursor = cursor ?? (draggable ? 'grab' : 'default');
      }
    },
    [draggable, mapRef],
  );

  const selectPlace = useCallback(
    (place: MapRendererPlace) => {
      const isSelected = selectedPlace?.id === place.id;
      if (interactionPriorityMode === 'active') {
        setActiveClusterKey(null);
        setActivePlaceId(isSelected ? null : place.id);
      }
      if (showDirections) {
        setSelectedPlace(isSelected ? null : place);
      }
      onPlaceClick?.(place);
    },
    [interactionPriorityMode, onPlaceClick, selectedPlace?.id, setSelectedPlace, showDirections],
  );

  const handleClusteredMapClick = useCallback(
    (event: ClusterPointerEvent) => {
      const feature = event.features?.[0];
      if (!feature?.layer?.id) {
        if (interactionPriorityMode === 'active') {
          setActiveClusterKey(null);
          setActivePlaceId(null);
        }
        return;
      }

      if (clusterLayerIds.includes(feature.layer.id)) {
        const clusterId = feature.properties?.id ?? null;
        if (interactionPriorityMode === 'active') {
          setActiveClusterKey(clusterId);
          setActivePlaceId(null);
        }
        if (hasExternalFeatureSource) {
          if (clusterId) {
            onFeatureClusterClick?.(clusterId);
          }
          return;
        }

        const map = mapRef.current;
        const cluster = clusterId ? clientClusterById.get(clusterId) : null;
        if (!map || !cluster) {
          return;
        }
        const isSingleCoordinateCluster =
          Math.abs(cluster.bounds.east - cluster.bounds.west) < 0.00001 &&
          Math.abs(cluster.bounds.north - cluster.bounds.south) < 0.00001;
        if (isSingleCoordinateCluster) {
          map.easeTo({
            center: [cluster.center.lng, cluster.center.lat],
            zoom: Math.min(map.getZoom() + 2, maxZoom),
            duration: instantTransitions ? 0 : 300,
          });
        } else {
          map.fitBounds(
            [
              [cluster.bounds.west, cluster.bounds.south],
              [cluster.bounds.east, cluster.bounds.north],
            ],
            { padding: 80, maxZoom, duration: instantTransitions ? 0 : 300 },
          );
        }
        return;
      }

      if (feature.layer.id !== unclusteredLayerId || hasExternalFeatureSource) {
        return;
      }
      const placeId = feature.properties?.id;
      const place = placeId ? placeById.get(placeId) : null;
      if (place) {
        selectPlace(place);
      }
    },
    [
      clientClusterById,
      clusterLayerIds,
      hasExternalFeatureSource,
      instantTransitions,
      interactionPriorityMode,
      mapRef,
      maxZoom,
      onFeatureClusterClick,
      placeById,
      selectPlace,
      unclusteredLayerId,
    ],
  );

  const handleClusteredMapHover = useCallback(
    (event: ClusterPointerEvent) => {
      if (interactionPriorityMode !== 'hover') {
        return;
      }
      const feature = event.features?.[0];
      if (feature?.layer?.id && clusterLayerIds.includes(feature.layer.id)) {
        setHoveredClusterKey(feature.properties?.id ?? null);
        setCanvasCursor('pointer');
      } else {
        setHoveredClusterKey(null);
        setCanvasCursor(null);
      }
    },
    [clusterLayerIds, interactionPriorityMode, setCanvasCursor],
  );

  const handleClusteredMapLeave = useCallback(() => {
    setHoveredClusterKey(null);
    setCanvasCursor(null);
  }, [setCanvasCursor]);

  const handleMarkerHover = useCallback(
    (placeId: string, hovered: boolean) => {
      if (interactionPriorityMode !== 'hover') {
        return;
      }
      setHoveredPlaceId((current) => (hovered ? placeId : current === placeId ? null : current));
    },
    [interactionPriorityMode],
  );

  return {
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
    handleMarkerClick: selectPlace,
  };
}
