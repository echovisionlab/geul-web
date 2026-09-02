// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type * as maplibregl from 'maplibre-gl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapRendererPlace } from '../types';
import { useMapInteractions } from './useMapInteractions';

const place = (name: string): MapRendererPlace => ({
  id: 'place-1',
  name,
  address: 'Seoul',
  lat: 37.5,
  lng: 127,
});

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('useMapInteractions', () => {
  it('navigates client clusters and selects the latest place projection', () => {
    const easeTo = vi.fn();
    const onPlaceClick = vi.fn();
    const map = {
      easeTo,
      fitBounds: vi.fn(),
      getZoom: () => 10,
      getCanvas: () => ({ style: {} }),
    } as unknown as maplibregl.Map;
    let interactions: ReturnType<typeof useMapInteractions> | null = null;

    function Harness({ places }: { places: MapRendererPlace[] }) {
      const [selectedPlace, setSelectedPlace] = useState<MapRendererPlace | null>(null);
      interactions = useMapInteractions({
        mapRef: { current: map },
        draggable: true,
        places,
        selectedPlace,
        setSelectedPlace,
        clusterLayerIds: ['cluster-layer'],
        unclusteredLayerId: 'place-layer',
        hasExternalFeatureSource: false,
        clientClusters: [
          {
            id: 'cluster-1',
            count: 2,
            center: { lat: 37.5, lng: 127 },
            bounds: { west: 127, south: 37.5, east: 127, north: 37.5 },
            placeIds: ['place-1', 'place-2'],
          },
        ],
        maxZoom: 16,
        instantTransitions: true,
        showDirections: true,
        onPlaceClick,
      });
      return <span>{selectedPlace?.name}</span>;
    }

    act(() => root.render(<Harness places={[place('Old name')]} />));
    act(() => {
      interactions?.handleClusteredMapClick({
        features: [{ layer: { id: 'cluster-layer' }, properties: { id: 'cluster-1' } }],
      });
    });
    expect(easeTo).toHaveBeenCalledWith({ center: [127, 37.5], zoom: 12, duration: 0 });

    act(() => root.render(<Harness places={[place('Current name')]} />));
    act(() => {
      interactions?.handleClusteredMapClick({
        features: [{ layer: { id: 'place-layer' }, properties: { id: 'place-1' } }],
      });
    });
    expect(host.textContent).toBe('Current name');
    expect(onPlaceClick).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Current name' }));
  });
});
