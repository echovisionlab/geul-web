// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { INITIAL_MAP_THEME_LIGHT_CONFIG } from '@/lib/types/map-theme/schema';
import { MapLibreMap } from './MapLibreMap';

const mocks = vi.hoisted(() => ({
  container: undefined as unknown as HTMLElement,
  mapRef: {
    getBounds: vi.fn(() => ({
      getWest: () => 120,
      getSouth: () => 30,
      getEast: () => 130,
      getNorth: () => 40,
    })),
    getCanvas: vi.fn(() => ({ style: {}, toDataURL: () => 'data:image/jpeg;base64,map' })),
    getCenter: vi.fn(() => ({ lat: 37, lng: 127 })),
    getContainer: vi.fn(() => mocks.container),
    getZoom: vi.fn(() => 12),
    loaded: vi.fn(() => true),
    areTilesLoaded: vi.fn(() => true),
    off: vi.fn(),
    once: vi.fn((_event: string, handler: () => void) => handler()),
    touchZoomRotate: {
      disableRotation: vi.fn(),
      enableRotation: vi.fn(),
    },
  },
  handleInteractionEnd: vi.fn(),
  handleInteractionStart: vi.fn(),
  handleMoveEnd: vi.fn(),
  handlePitchEnd: vi.fn(),
  handleRotateEnd: vi.fn(),
  handleZoomEnd: vi.fn(),
}));

vi.mock('dom-to-image-more', () => ({
  default: {
    toJpeg: vi.fn().mockResolvedValue('data:image/jpeg;base64,dom'),
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string>) =>
    values?.label ? `${namespace}.${key}:${values.label}` : `${namespace}.${key}`,
}));

vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children, ref, onLoad, onMoveStart, onMoveEnd, onZoomStart, onZoomEnd, ...props }: any) => {
    ref?.({ getMap: () => mocks.mapRef });
    return (
      <div
        data-map-view
        data-props={JSON.stringify({
          dragPan: props.dragPan,
          dragRotate: props.dragRotate,
          keyboard: props.keyboard,
          mapStyleName: typeof props.mapStyle === 'string' ? props.mapStyle : props.mapStyle?.name,
          minZoom: props.minZoom,
          maxZoom: props.maxZoom,
          touchPitch: props.touchPitch,
          touchZoomRotate: props.touchZoomRotate,
        })}
      >
        <canvas className="maplibregl-canvas" data-map-canvas />
        <button type="button" data-load-map onClick={() => onLoad?.({ target: mocks.mapRef })}>
          load
        </button>
        <button
          type="button"
          data-move-map
          onClick={() => {
            onMoveStart?.({ originalEvent: new MouseEvent('mousedown') });
            onMoveEnd?.({ originalEvent: new MouseEvent('mouseup') });
          }}
        >
          move
        </button>
        <button
          type="button"
          data-zoom-map
          onClick={() => {
            onZoomStart?.({ originalEvent: new WheelEvent('wheel') });
            onZoomEnd?.({ originalEvent: new WheelEvent('wheel') });
          }}
        >
          zoom
        </button>
        {children}
      </div>
    );
  },
  Layer: (props: { id: string }) => <div data-layer={props.id} />,
  Marker: ({ children, longitude, latitude }: any) => <div data-marker={`${longitude},${latitude}`}>{children}</div>,
  NavigationControl: ({ position }: { position: string }) => <div data-navigation={position} />,
  Source: ({ children, id }: { children: React.ReactNode; id: string }) => <div data-source={id}>{children}</div>,
}));

vi.mock('./hooks', () => ({
  useCalloutDirection: () => ({
    containerWidth: 960,
    getPlacement: (_id: string, index: number) => ({
      direction: index % 2 === 0 ? 'right' : 'left',
      stackOffsetY: index * 10,
    }),
  }),
  useMap3DBuildings: vi.fn(),
  useMapAutoRotate: vi.fn(),
  useMapControl: () => ({
    userInteractingRef: { current: false },
    handleInteractionStart: mocks.handleInteractionStart,
    handleInteractionEnd: mocks.handleInteractionEnd,
    handleMoveEnd: mocks.handleMoveEnd,
    handleZoomEnd: mocks.handleZoomEnd,
    handlePitchEnd: mocks.handlePitchEnd,
    handleRotateEnd: mocks.handleRotateEnd,
  }),
  useMapLabels: vi.fn(),
  useMapInteractions: ({ setSelectedPlace, showDirections, onPlaceClick }: any) => ({
    interactionPriorityMode: 'hover',
    hoveredClusterKey: null,
    activeClusterKey: null,
    hoveredPlaceId: null,
    activePlaceId: null,
    setActiveClusterKey: vi.fn(),
    setActivePlaceId: vi.fn(),
    setCanvasCursor: vi.fn(),
    handleClusteredMapClick: vi.fn(),
    handleClusteredMapHover: vi.fn(),
    handleClusteredMapLeave: vi.fn(),
    handleMarkerHover: vi.fn(),
    handleMarkerClick: (place: unknown) => {
      if (showDirections) {
        setSelectedPlace(place);
      }
      onPlaceClick?.(place);
    },
  }),
  useMapPrintCapture: () => null,
  useMapLoadingState: () => ({
    setLoadingStage: vi.fn(),
    isReady: true,
    loadingMessage: 'Ready',
  }),
  useScreenSpaceCluster: () => ({
    enabled: false,
    clusters: [],
    singletonPlaceIds: [],
    featureSourceData: null,
  }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 0);
}

if (!window.cancelAnimationFrame) {
  window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
}

let host: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.container = document.createElement('div');
  Object.defineProperties(mocks.container, {
    clientWidth: { configurable: true, value: 640 },
    clientHeight: { configurable: true, value: 360 },
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  host = null;
  root = null;
});

describe('MapLibreMap', () => {
  it('synchronizes the combined touch handler without changing mouse rotation capability', async () => {
    const renderMap = async ({ rotatable, zoomable }: { rotatable: boolean; zoomable: boolean }) => {
      await act(async () => {
        root?.render(
          <MantineProvider>
            <MapLibreMap
              places={[]}
              center={{ lat: 37.5, lng: 127.1 }}
              zoom={12}
              themeConfig={INITIAL_MAP_THEME_LIGHT_CONFIG}
              draggable={false}
              zoomable={zoomable}
              rotatable={rotatable}
              tiltable={false}
            />
          </MantineProvider>,
        );
      });

      return JSON.parse(document.querySelector<HTMLElement>('[data-map-view]')?.dataset.props ?? '{}');
    };

    let props = await renderMap({ rotatable: false, zoomable: true });
    expect(props).toEqual(
      expect.objectContaining({
        dragRotate: false,
        keyboard: true,
        touchZoomRotate: { around: 'center' },
      }),
    );
    expect(mocks.mapRef.touchZoomRotate.disableRotation).toHaveBeenCalledOnce();

    act(() => {
      document.querySelector<HTMLButtonElement>('[data-load-map]')?.click();
    });
    expect(mocks.mapRef.touchZoomRotate.disableRotation).toHaveBeenCalledTimes(2);

    props = await renderMap({ rotatable: true, zoomable: true });
    expect(props.dragRotate).toBe(true);
    expect(props.touchZoomRotate).toEqual({ around: 'center' });
    expect(mocks.mapRef.touchZoomRotate.enableRotation).toHaveBeenCalledOnce();

    props = await renderMap({ rotatable: true, zoomable: false });
    expect(props).toEqual(
      expect.objectContaining({
        dragRotate: true,
        keyboard: true,
        touchZoomRotate: false,
      }),
    );
    expect(mocks.mapRef.touchZoomRotate.disableRotation).toHaveBeenCalledTimes(3);
  });

  it('filters only disallowed MapLibre keyboard capabilities at the runtime container', async () => {
    await act(async () => {
      root?.render(
        <MantineProvider>
          <MapLibreMap
            places={[]}
            center={{ lat: 37.5, lng: 127.1 }}
            zoom={12}
            themeConfig={INITIAL_MAP_THEME_LIGHT_CONFIG}
            draggable={false}
            zoomable
            rotatable={false}
            tiltable
          />
        </MantineProvider>,
      );
    });

    const props = JSON.parse(document.querySelector<HTMLElement>('[data-map-view]')?.dataset.props ?? '{}');
    expect(props.keyboard).toBe(true);

    const canvas = document.querySelector<HTMLCanvasElement>('[data-map-canvas]');
    const mapLibreKeydown = vi.fn();
    canvas?.addEventListener('keydown', mapLibreKeydown);

    const dispatchKey = (keyCode: number, shiftKey = false) => {
      const event = new KeyboardEvent('keydown', { bubbles: true, shiftKey });
      Object.defineProperty(event, 'keyCode', { configurable: true, value: keyCode });
      canvas?.dispatchEvent(event);
      return event;
    };

    const blockedPan = dispatchKey(37);
    expect(mapLibreKeydown).not.toHaveBeenCalled();
    expect(blockedPan.defaultPrevented).toBe(false);

    dispatchKey(187);
    expect(mapLibreKeydown).toHaveBeenCalledOnce();

    dispatchKey(37, true);
    expect(mapLibreKeydown).toHaveBeenCalledOnce();

    dispatchKey(38, true);
    expect(mapLibreKeydown).toHaveBeenCalledTimes(2);
  });

  it('passes an injected map style to the MapLibre runtime', async () => {
    await act(async () => {
      root?.render(
        <MantineProvider>
          <MapLibreMap
            places={[]}
            center={{ lat: 37.5, lng: 127.1 }}
            zoom={12}
            themeConfig={INITIAL_MAP_THEME_LIGHT_CONFIG}
            mapStyleOverride={{
              version: 8,
              name: 'Offline fixture',
              sources: {},
              layers: [
                {
                  id: 'background',
                  type: 'background',
                  paint: { 'background-color': '#f5f5f5' },
                },
              ],
            }}
          />
        </MantineProvider>,
      );
    });

    const props = JSON.parse(document.querySelector<HTMLElement>('[data-map-view]')?.dataset.props ?? '{}');
    expect(props.mapStyleName).toBe('Offline fixture');
  });

  it('renders callouts, map controls, attribution, and the directions chooser', async () => {
    const onPlaceClick = vi.fn();
    const onViewportSettled = vi.fn();

    await act(async () => {
      root?.render(
        <MantineProvider>
          <MapLibreMap
            places={[
              {
                id: 'place-1',
                name: 'Studio',
                address: 'Seoul',
                lat: 37.5,
                lng: 127.1,
                href: undefined,
                addressComponents: { city: 'Seoul', country: 'KR' },
              },
            ]}
            center={{ lat: 37.5, lng: 127.1 }}
            zoom={12}
            minZoom={3}
            maxZoom={18}
            onPlaceClick={onPlaceClick}
            onViewportSettled={onViewportSettled}
            zoomPosition="bottom-right"
            themeConfig={{
              backgroundColor: '#ffffff',
              waterColor: '#dbeafe',
              landColor: '#f8fafc',
              roadColor: '#cbd5e1',
              buildingFillColor: '#e2e8f0',
              buildingStrokeEnabled: true,
              buildingStrokeColor: '#94a3b8',
              labelTextColor: '#111827',
              calloutLineColor: '#2563eb',
              calloutHoverLineColor: '#1d4ed8',
              calloutTextColor: '#111827',
              calloutHoverTextColor: '#000000',
              calloutDescriptionColor: '#4b5563',
              calloutHoverDescriptionColor: '#111827',
              calloutBackgroundColor: 'transparent',
              calloutHoverBackgroundColor: 'rgba(255,255,255,0.95)',
              calloutScale: 1,
              calloutOffsetX: 2,
              calloutOffsetY: 4,
              calloutFields: ['name', 'city', 'coordinates'],
              clusterColor: '#ffffff',
              clusterHoverColor: '#e0f2fe',
              clusterTextColor: '#0f172a',
              clusterTextHoverColor: '#020617',
              attributionColor: '#334155',
              attributionFontSize: 10,
              showAreaLabels: true,
              showPoiLabels: false,
            }}
          />
        </MantineProvider>,
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(document.querySelector('[data-navigation="bottom-right"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Studio');
    expect(document.body.textContent).toContain('OpenMapTiles');

    act(() => {
      document.querySelector<HTMLButtonElement>('[data-load-map]')?.click();
      document.querySelector<HTMLButtonElement>('[data-move-map]')?.click();
      document.querySelector<HTMLButtonElement>('[data-zoom-map]')?.click();
    });

    expect(onViewportSettled).toHaveBeenCalledWith(
      expect.objectContaining({
        center: { lat: 37, lng: 127 },
        zoom: 12,
        widthPx: 640,
        heightPx: 360,
      }),
    );
    expect(mocks.handleInteractionStart).toHaveBeenCalled();
    expect(mocks.handleMoveEnd).toHaveBeenCalledWith(true, true);
    expect(mocks.handleZoomEnd).toHaveBeenCalledWith(true, false);

    act(() => {
      document
        .querySelector<HTMLElement>('.mgl-callout')
        ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });

    expect(onPlaceClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'place-1' }));
    expect(document.body.textContent).toContain('map.directions');
    expect(document.body.textContent).toContain('Google Maps');
  });
});
