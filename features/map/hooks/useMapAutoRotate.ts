import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';

export interface UseMapAutoRotateOptions {
  mapRef: React.RefObject<maplibregl.Map | null>;
  isReady: boolean;
  enabled: boolean;
  speed: number;
  pitch: number;
  userInteractingRef: React.RefObject<boolean>;
  pauseRef?: React.RefObject<boolean>;
}

/**
 * Manages auto-rotation using requestAnimationFrame
 * Only rotates when pitch > 0 (3D effect)
 * Pauses during user interaction
 */
export function useMapAutoRotate({
  mapRef,
  isReady,
  enabled,
  speed,
  pitch,
  userInteractingRef,
  pauseRef,
}: UseMapAutoRotateOptions) {
  useEffect(() => {
    if (!mapRef.current || !isReady) {
      return;
    }
    if (!enabled || pitch <= 0) {
      return;
    }

    const map = mapRef.current;
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      // Pause auto-rotate during direct interaction or when a callout is hovered/focused.
      if (userInteractingRef.current || pauseRef?.current) {
        lastTime = currentTime; // Keep time in sync
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;

      const currentBearing = map.getBearing();
      const newBearing = (currentBearing + speed * deltaTime) % 360;
      map.setBearing(newBearing);

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [mapRef, isReady, enabled, speed, pitch, userInteractingRef, pauseRef]);
}
