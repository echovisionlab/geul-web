// @vitest-environment jsdom

import { act, useEffect, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScreenSpaceClusterSnapshot } from '../utils';
import { useScreenSpaceCluster, type UseScreenSpaceClusterOptions } from './useScreenSpaceCluster';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Listener = () => void;
type MapEvent = 'render' | 'moveend';

class MockMap {
  listeners: Record<MapEvent, Set<Listener>> = {
    render: new Set(),
    moveend: new Set(),
  };

  zoom = 15;
  projectionMap = new Map<string, { x: number; y: number }>();

  getZoom() {
    return this.zoom;
  }

  project([lng, lat]: [number, number]) {
    return this.projectionMap.get(`${lng}:${lat}`) ?? { x: 0, y: 0 };
  }

  on(event: MapEvent, listener: Listener) {
    this.listeners[event].add(listener);
  }

  off(event: MapEvent, listener: Listener) {
    this.listeners[event].delete(listener);
  }

  emit(event: MapEvent) {
    for (const listener of this.listeners[event]) {
      listener();
    }
  }
}

function Harness({
  options,
  onReady,
}: {
  options: UseScreenSpaceClusterOptions;
  onReady: (value: ScreenSpaceClusterSnapshot) => void;
}) {
  const snapshot = useScreenSpaceCluster(options);

  useEffect(() => {
    onReady(snapshot);
  }, [snapshot, onReady]);

  return null;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function renderHarness(
  options: UseScreenSpaceClusterOptions,
  onReady: (value: ScreenSpaceClusterSnapshot) => void,
): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<Harness options={options} onReady={onReady} />);
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
});

function expectSnapshot(value: ScreenSpaceClusterSnapshot | null): ScreenSpaceClusterSnapshot {
  expect(value).not.toBeNull();
  return value as ScreenSpaceClusterSnapshot;
}

describe('useScreenSpaceCluster', () => {
  it('returns clustered groups and singleton ids from one shared snapshot', () => {
    const map = new MockMap();
    map.projectionMap.set('126.978:37.5665', { x: 100, y: 100 });
    map.projectionMap.set('126.9781:37.5666', { x: 128, y: 112 });
    map.projectionMap.set('126.981:37.57', { x: 320, y: 280 });
    let latestSnapshot: ScreenSpaceClusterSnapshot | null = null;

    renderHarness(
      {
        mapRef: { current: map } as RefObject<any>,
        enabled: true,
        isReady: true,
        places: [
          { id: 'place-1', lng: 126.978, lat: 37.5665 },
          { id: 'place-2', lng: 126.9781, lat: 37.5666 },
          { id: 'place-3', lng: 126.981, lat: 37.57 },
        ],
        clusterRadiusPx: 56,
        clusterMaxZoom: 22,
      },
      (value) => {
        latestSnapshot = value;
      },
    );

    const snapshot = expectSnapshot(latestSnapshot);
    expect(snapshot.enabled).toBe(true);
    expect(snapshot.clusters).toHaveLength(1);
    expect(snapshot.clusters[0]?.placeIds).toEqual(['place-1', 'place-2']);
    expect(snapshot.singletonPlaceIds).toEqual(['place-3']);
    expect(snapshot.featureSourceData?.features).toHaveLength(1);
  });

  it('returns all places as singletons when the map zoom is above the cluster max zoom', () => {
    const map = new MockMap();
    map.projectionMap.set('126.978:37.5665', { x: 100, y: 100 });
    map.projectionMap.set('126.9781:37.5666', { x: 128, y: 112 });
    let latestSnapshot: ScreenSpaceClusterSnapshot | null = null;

    renderHarness(
      {
        mapRef: { current: map } as RefObject<any>,
        enabled: true,
        isReady: true,
        places: [
          { id: 'place-1', lng: 126.978, lat: 37.5665 },
          { id: 'place-2', lng: 126.9781, lat: 37.5666 },
        ],
        clusterRadiusPx: 56,
        clusterMaxZoom: 12,
      },
      (value) => {
        latestSnapshot = value;
      },
    );

    const snapshot = expectSnapshot(latestSnapshot);
    expect(snapshot.enabled).toBe(false);
    expect(snapshot.clusters).toHaveLength(0);
    expect(snapshot.singletonPlaceIds).toEqual(['place-1', 'place-2']);
  });

  it('re-samples during render frames instead of recalculating every frame', () => {
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(0);
    const map = new MockMap();
    map.projectionMap.set('126.978:37.5665', { x: 100, y: 100 });
    map.projectionMap.set('126.9781:37.5666', { x: 128, y: 112 });
    let latestSnapshot: ScreenSpaceClusterSnapshot | null = null;

    renderHarness(
      {
        mapRef: { current: map } as RefObject<any>,
        enabled: true,
        isReady: true,
        places: [
          { id: 'place-1', lng: 126.978, lat: 37.5665 },
          { id: 'place-2', lng: 126.9781, lat: 37.5666 },
        ],
        clusterRadiusPx: 56,
        clusterMaxZoom: 22,
        sampleIntervalMs: 120,
      },
      (value) => {
        latestSnapshot = value;
      },
    );

    expect(expectSnapshot(latestSnapshot).enabled).toBe(true);

    map.projectionMap.set('126.9781:37.5666', { x: 260, y: 240 });

    act(() => {
      nowSpy.mockReturnValue(50);
      map.emit('render');
    });

    expect(expectSnapshot(latestSnapshot).enabled).toBe(true);

    act(() => {
      nowSpy.mockReturnValue(160);
      map.emit('render');
    });

    const snapshot = expectSnapshot(latestSnapshot);
    expect(snapshot.enabled).toBe(false);
    expect(snapshot.singletonPlaceIds).toEqual(['place-1', 'place-2']);
    nowSpy.mockRestore();
  });
});
