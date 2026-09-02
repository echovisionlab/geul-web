// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { MapView } from './View';

const mapViewEmbeddedSpy = vi.fn();

vi.mock('@/features/map/MapViewEmbedded', () => ({
  MapViewEmbedded: (props: { caption?: ReactNode }) => {
    mapViewEmbeddedSpy(props);
    return <div data-map-view-embedded>{props.caption}</div>;
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  mapViewEmbeddedSpy.mockReset();
});

describe('MapView', () => {
  it('renders the stored viewport when no places are attached', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TestProviders>
          <MapView
            props={{
              centerLat: '35.6812',
              centerLng: '139.7671',
              zoom: '12',
              mapPlaceIds: '',
            }}
          />
        </TestProviders>,
      );
    });

    expect(mapViewEmbeddedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        allowEmpty: true,
        config: expect.objectContaining({
          center: { lat: 35.6812, lng: 139.7671 },
          zoom: 12,
          places: [],
        }),
      }),
    );
    expect(container?.textContent).not.toContain('No locations set');
  });

  it('renders an existing legacy location at its stored viewport', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TestProviders>
          <MapView
            props={{
              mapPlaceId: 'legacy-place',
              location: JSON.stringify({ name: 'Seoul', lat: 37.5665, lng: 126.978 }),
              zoom: '13',
            }}
          />
        </TestProviders>,
      );
    });

    expect(mapViewEmbeddedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        allowEmpty: true,
        config: expect.objectContaining({
          center: { lat: 37.5665, lng: 126.978 },
          zoom: 13,
        }),
      }),
    );
  });

  it('passes textAlignment through to the embedded map view', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TestProviders>
          <MapView
            props={{
              mapViewConfig: {
                center: { lat: 37.5665, lng: 126.978 },
                zoom: 15,
                minZoom: -2,
                maxZoom: 22,
                pitch: 0,
                bearing: 0,
                aspectRatio: '16:9',
                previewWidth: 60,
                draggable: true,
                zoomable: true,
                rotatable: false,
                tiltable: false,
                pinClickable: true,
                autoRotate: false,
                autoRotateSpeed: 1,
                showDirections: true,
                show3DBuildings: false,
                preferredScheme: 'auto',
                places: [
                  {
                    id: 'place-1',
                    name: 'Place 1',
                    address: 'Seoul',
                    lat: 37.5665,
                    lng: 126.978,
                  },
                ],
                theme: null,
              },
              textAlignment: 'right',
            }}
          />
        </TestProviders>,
      );
    });

    expect(mapViewEmbeddedSpy).toHaveBeenCalledWith(expect.objectContaining({ blockAlignment: 'right' }));
  });

  it('keeps the public caption compact and left-aligned like authoring', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TestProviders>
          <MapView props={{ caption: 'Stored viewport', textAlignment: 'center' }} />
        </TestProviders>,
      );
    });

    const caption = container?.querySelector<HTMLElement>('[data-public-map-caption]');
    expect(caption?.textContent).toBe('Stored viewport');
    expect(caption?.style.textAlign).toBe('left');
    expect(caption?.style.marginTop).toBe('0.25rem');
    expect(caption?.style.padding).toBe('0px');
    expect(caption?.style.fontSize).toBe('var(--mantine-font-size-sm)');
    expect(caption?.style.lineHeight).toBe('1.55');
  });
});
