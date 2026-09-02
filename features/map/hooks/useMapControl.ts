import { useCallback, useEffect, useRef } from 'react';
import type * as maplibregl from 'maplibre-gl';

const ZOOM_SYNC_EPSILON = 0.001;
const CAMERA_SYNC_EPSILON = 0.1;

export interface UseMapControlOptions {
  mapRef: React.RefObject<maplibregl.Map | null>;
  isReady: boolean;
  center: { lat: number; lng: number };
  zoom: number;
  pitch: number;
  bearing: number;
  instantTransitions?: boolean;
  onCenterChange?: (center: { lat: number; lng: number }) => void;
  onZoomChange?: (zoom: number) => void;
  onPitchChange?: (pitch: number) => void;
  onBearingChange?: (bearing: number) => void;
}

/**
 * Manages map-props synchronization and user interaction tracking
 */
export function useMapControl({
  mapRef,
  isReady,
  center,
  zoom,
  pitch,
  bearing,
  instantTransitions = false,
  onCenterChange,
  onZoomChange,
  onPitchChange,
  onBearingChange,
}: UseMapControlOptions) {
  // Track user interaction to prevent sync during drag/zoom
  const userInteractingRef = useRef(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const logicalCenterRef = useRef(center);

  useEffect(() => {
    logicalCenterRef.current = center;
  }, [center.lat, center.lng]);

  const markUserInteracting = useCallback(() => {
    userInteractingRef.current = true;
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      userInteractingRef.current = false;
    }, 500);
  }, []);

  // For auto-rotate: set flag on interaction start, clear after interaction end
  const handleInteractionStart = useCallback(() => {
    userInteractingRef.current = true;
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }
  }, []);

  const handleInteractionEnd = useCallback(() => {
    // Delay to allow smooth transition back to auto-rotate
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      userInteractingRef.current = false;
    }, 300);
  }, []);

  const handleMoveEnd = useCallback(
    (isUserInteraction: boolean, persistCenter = true) => {
      if (!mapRef.current || !isUserInteraction) {
        return;
      }
      markUserInteracting();
      if (!persistCenter) {
        return;
      }
      const c = mapRef.current.getCenter();
      logicalCenterRef.current = { lat: c.lat, lng: c.lng };
      onCenterChange?.({ lat: c.lat, lng: c.lng });
    },
    [mapRef, onCenterChange, markUserInteracting],
  );

  const handleZoomEnd = useCallback(
    (isUserInteraction: boolean, restoreCenter = false) => {
      if (!mapRef.current || !isUserInteraction) {
        return;
      }
      const map = mapRef.current;
      markUserInteracting();
      const currentZoom = map.getZoom();
      onZoomChange?.(currentZoom);

      if (!restoreCenter) {
        return;
      }

      const logicalCenter = logicalCenterRef.current;
      const currentCenter = map.getCenter();
      const centerMatch =
        Math.abs(currentCenter.lat - logicalCenter.lat) < 0.0001 &&
        Math.abs(currentCenter.lng - logicalCenter.lng) < 0.0001;
      if (centerMatch) {
        return;
      }

      const cameraState = {
        center: [logicalCenter.lng, logicalCenter.lat] as [number, number],
        zoom: currentZoom,
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      };

      if (instantTransitions) {
        map.jumpTo(cameraState);
        return;
      }

      map.easeTo({
        ...cameraState,
        duration: 300,
      });
    },
    [mapRef, onZoomChange, markUserInteracting, instantTransitions],
  );

  const handlePitchEnd = useCallback(
    (isUserInteraction: boolean) => {
      if (!mapRef.current || !onPitchChange || !isUserInteraction) {
        return;
      }
      markUserInteracting();
      onPitchChange(mapRef.current.getPitch());
    },
    [mapRef, onPitchChange, markUserInteracting],
  );

  const handleRotateEnd = useCallback(
    (isUserInteraction: boolean) => {
      if (!mapRef.current || !onBearingChange || !isUserInteraction) {
        return;
      }
      markUserInteracting();
      onBearingChange(mapRef.current.getBearing());
    },
    [mapRef, onBearingChange, markUserInteracting],
  );

  // Sync props to map
  useEffect(() => {
    if (!mapRef.current || !isReady) {
      return;
    }
    // Skip sync during user interaction to prevent race conditions
    if (userInteractingRef.current) {
      return;
    }

    const map = mapRef.current;
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const currentPitch = map.getPitch();
    const currentBearing = map.getBearing();

    // Check each property independently
    const centerMatch =
      Math.abs(currentCenter.lat - center.lat) < 0.0001 && Math.abs(currentCenter.lng - center.lng) < 0.0001;
    const zoomMatch = Math.abs(currentZoom - zoom) < ZOOM_SYNC_EPSILON;
    const pitchMatch = Math.abs(currentPitch - pitch) < CAMERA_SYNC_EPSILON;
    const bearingMatch = Math.abs(currentBearing - bearing) < CAMERA_SYNC_EPSILON;

    // Skip if all values match
    if (centerMatch && zoomMatch && pitchMatch && bearingMatch) {
      return;
    }

    if (instantTransitions) {
      map.jumpTo({ center: [center.lng, center.lat], zoom, pitch, bearing });
    } else {
      map.easeTo({ center: [center.lng, center.lat], zoom, pitch, bearing, duration: 300 });
    }
  }, [mapRef, isReady, center.lng, center.lat, zoom, pitch, bearing, instantTransitions]);

  return {
    userInteractingRef,
    handleInteractionStart,
    handleInteractionEnd,
    handleMoveEnd,
    handleZoomEnd,
    handlePitchEnd,
    handleRotateEnd,
  };
}
