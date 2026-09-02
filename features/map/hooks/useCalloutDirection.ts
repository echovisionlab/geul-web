import { useCallback, useEffect, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { MapRendererPlace } from '../types';

interface PlaceCalloutPlacement {
  direction: 'left' | 'right';
  stackOffsetY: number;
}

export interface UseCalloutDirectionOptions {
  mapRef: React.RefObject<maplibregl.Map | null>;
  places: MapRendererPlace[];
  isReady: boolean;
}

/**
 * Calculates callout directions based on marker screen position
 * Uses hysteresis (5% dead zone) to prevent flickering when marker is near center
 */
export function useCalloutDirection({ mapRef, places, isReady }: UseCalloutDirectionOptions) {
  const [placePlacements, setPlacePlacements] = useState<Record<string, PlaceCalloutPlacement>>({});
  const [containerWidth, setContainerWidth] = useState(1920);

  // Calculate callout direction based on marker position
  // Uses hysteresis to prevent flickering when marker is near center
  const calculatePlaceDirections = useCallback(() => {
    if (!mapRef.current || places.length === 0) {
      return;
    }

    const map = mapRef.current;
    const width = map.getContainer().clientWidth;
    const centerX = width / 2;
    // 5% dead zone on each side of center to prevent flickering
    const deadZone = width * 0.05;
    const conflictDistanceX = Math.max(width * 0.08, 96);
    const conflictDistanceY = 32;
    const laneStepY = 18;
    const lanePattern = [0, 1, -1, 2, -2, 3, -3, 4, -4];

    setPlacePlacements((prev) => {
      const provisional = places.map((place, index) => {
        const point = map.project([place.lng, place.lat]);
        const previousPlacement = prev[place.id];
        const currentDirection = previousPlacement?.direction;
        let direction: 'left' | 'right';

        if (currentDirection === 'right') {
          direction = point.x > centerX + deadZone ? 'left' : 'right';
        } else if (currentDirection === 'left') {
          direction = point.x < centerX - deadZone ? 'right' : 'left';
        } else {
          direction = point.x < centerX ? 'right' : 'left';
        }

        return {
          place,
          index,
          x: point.x,
          y: point.y,
          direction,
        };
      });

      const nextPlacements: Record<string, PlaceCalloutPlacement> = {};

      for (const direction of ['right', 'left'] as const) {
        const directional = provisional
          .filter((entry) => entry.direction === direction)
          .sort((a, b) => {
            const yDiff = a.y - b.y;
            if (Math.abs(yDiff) > 0.5) {
              return yDiff;
            }
            return a.index - b.index;
          });

        const placed: Array<{ x: number; y: number; lane: number }> = [];

        for (const entry of directional) {
          let chosenLane = 0;

          for (const candidateLane of lanePattern) {
            const candidateY = entry.y + candidateLane * laneStepY;
            const hasConflict = placed.some(
              (other) =>
                Math.abs(other.x - entry.x) < conflictDistanceX && Math.abs(other.y - candidateY) < conflictDistanceY,
            );

            if (!hasConflict) {
              chosenLane = candidateLane;
              break;
            }
          }

          placed.push({
            x: entry.x,
            y: entry.y + chosenLane * laneStepY,
            lane: chosenLane,
          });

          nextPlacements[entry.place.id] = {
            direction,
            stackOffsetY: chosenLane * laneStepY,
          };
        }
      }

      for (const place of places) {
        if (!nextPlacements[place.id]) {
          nextPlacements[place.id] = {
            direction: prev[place.id]?.direction ?? 'right',
            stackOffsetY: 0,
          };
        }
      }

      return nextPlacements;
    });
  }, [mapRef, places]);

  // Recalculate directions on map move and track container width
  useEffect(() => {
    if (!mapRef.current || !isReady) {
      return;
    }

    const map = mapRef.current;
    const container = map.getContainer();

    // Initial calculations
    calculatePlaceDirections();
    setContainerWidth(container.clientWidth);

    // Recalculate on move end
    const handleMove = () => calculatePlaceDirections();
    map.on('moveend', handleMove);

    // Track resize for responsive callout sizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    resizeObserver.observe(container);

    return () => {
      map.off('moveend', handleMove);
      resizeObserver.disconnect();
    };
  }, [mapRef, isReady, calculatePlaceDirections]);

  const getPlacement = useCallback(
    (placeId: string, fallbackIndex: number): PlaceCalloutPlacement => {
      return (
        placePlacements[placeId] ?? {
          direction: fallbackIndex % 2 === 0 ? 'right' : 'left',
          stackOffsetY: 0,
        }
      );
    },
    [placePlacements],
  );

  return {
    containerWidth,
    getPlacement,
  };
}
