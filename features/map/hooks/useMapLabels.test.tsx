// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useMapLabels } from './useMapLabels';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface FakeLayer {
  id: string;
  type: string;
  source?: string;
  'source-layer'?: string;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
}

class FakeMap {
  private readonly layers = new Map<string, FakeLayer>();

  private readonly sources = new Set<string>();

  constructor(initialLayers: FakeLayer[]) {
    for (const layer of initialLayers) {
      this.layers.set(layer.id, {
        ...layer,
        layout: { visibility: 'visible', ...(layer.layout ?? {}) },
        paint: { ...(layer.paint ?? {}) },
      });
      if (layer.source) {
        this.sources.add(layer.source);
      }
    }
  }

  getStyle() {
    return {
      layers: Array.from(this.layers.values()),
    };
  }

  getLayer(id: string) {
    return this.layers.get(id);
  }

  getSource(id: string) {
    return this.sources.has(id) ? { id } : undefined;
  }

  addLayer(layer: FakeLayer) {
    this.layers.set(layer.id, {
      ...layer,
      layout: { visibility: 'visible', ...(layer.layout ?? {}) },
      paint: { ...(layer.paint ?? {}) },
    });
  }

  removeLayer(id: string) {
    this.layers.delete(id);
  }

  setLayoutProperty(id: string, key: string, value: unknown) {
    const layer = this.layers.get(id);
    if (!layer) {
      throw new Error(`Missing layer: ${id}`);
    }
    layer.layout = { ...(layer.layout ?? {}), [key]: value };
  }

  setPaintProperty(id: string, key: string, value: unknown) {
    const layer = this.layers.get(id);
    if (!layer) {
      throw new Error(`Missing layer: ${id}`);
    }
    layer.paint = { ...(layer.paint ?? {}), [key]: value };
  }

  isStyleLoaded() {
    return true;
  }

  once(_event: string, _handler: () => void) {
    // noop
  }

  off(_event: string, _handler: () => void) {
    // noop
  }
}

function Harness({
  map,
  showAreaLabels,
  showPoiLabels,
  labelLocale,
}: {
  map: FakeMap;
  showAreaLabels: boolean;
  showPoiLabels: boolean;
  labelLocale?: string | null;
}) {
  useMapLabels({
    mapRef: { current: map as never },
    isReady: true,
    showAreaLabels,
    showPoiLabels,
    labelLocale,
    colorScheme: 'light',
  });

  return null;
}

let host: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  host = null;
  root = null;
});

describe('useMapLabels', () => {
  it('keeps world context labels while hiding local area and poi labels', async () => {
    const map = new FakeMap([
      {
        id: 'place_country_major',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
      },
      {
        id: 'place_city',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
      },
      {
        id: 'water_name',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'water_name',
      },
      {
        id: 'highway_name_major',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
      },
      {
        id: 'poi_r1',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'poi',
      },
    ]);

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<Harness map={map} showAreaLabels={false} showPoiLabels={false} />);
    });

    expect(map.getLayer('place_country_major')?.layout?.visibility).toBe('none');
    expect(map.getLayer('place_city')?.layout?.visibility).toBe('none');
    expect(map.getLayer('water_name')?.layout?.visibility).toBe('none');
    expect(map.getLayer('highway_name_major')?.layout?.visibility).toBe('none');
    expect(map.getLayer('poi_r1')?.layout?.visibility).toBe('none');

    expect(map.getLayer('world-area-labels')).toBeTruthy();
    expect(map.getLayer('world-water-point-labels')).toBeTruthy();
    expect(map.getLayer('world-water-line-labels')).toBeTruthy();
  });

  it('applies the requested locale text-field to native and custom label layers', async () => {
    const map = new FakeMap([
      {
        id: 'place_country_major',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
      },
      {
        id: 'place_city',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
      },
      {
        id: 'highway_name_major',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
      },
      {
        id: 'poi_r1',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'poi',
      },
    ]);

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<Harness map={map} showAreaLabels showPoiLabels labelLocale="de" />);
    });

    expect(map.getLayer('world-area-labels')?.layout?.['text-field']).toEqual([
      'coalesce',
      ['get', 'name:de'],
      ['get', 'name_de'],
      ['get', 'name:en'],
      ['get', 'name_en'],
      ['get', 'name_int'],
      ['get', 'name:latin'],
      ['get', 'name:nonlatin'],
      ['get', 'name'],
    ]);
    expect(map.getLayer('place_city')?.layout?.['text-field']).toEqual([
      'coalesce',
      ['get', 'name:de'],
      ['get', 'name_de'],
      ['get', 'name:en'],
      ['get', 'name_en'],
      ['get', 'name_int'],
      ['get', 'name:latin'],
      ['get', 'name:nonlatin'],
      ['get', 'name'],
    ]);
    expect(map.getLayer('highway_name_major')?.layout?.['text-field']).toEqual([
      'coalesce',
      ['get', 'name:de'],
      ['get', 'name_de'],
      ['get', 'name:en'],
      ['get', 'name_en'],
      ['get', 'name_int'],
      ['get', 'name:latin'],
      ['get', 'name:nonlatin'],
      ['get', 'name'],
    ]);
    expect(map.getLayer('poi_r1')?.layout?.['text-field']).toEqual([
      'coalesce',
      ['get', 'name:de'],
      ['get', 'name_de'],
      ['get', 'name:en'],
      ['get', 'name_en'],
      ['get', 'name_int'],
      ['get', 'name:latin'],
      ['get', 'name:nonlatin'],
      ['get', 'name'],
    ]);
    expect(map.getLayer('world-area-labels')?.layout?.['text-font']).toEqual(['Noto Sans Bold']);
    expect(map.getLayer('world-water-point-labels')?.layout?.['text-font']).toEqual(['Noto Sans Regular']);
    expect(map.getLayer('world-water-line-labels')?.layout?.['text-font']).toEqual(['Noto Sans Regular']);
  });
});
