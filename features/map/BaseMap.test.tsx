// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { BaseMap } from './BaseMap';

const mocks = vi.hoisted(() => ({
  apiKey: '',
  listeners: new Map<string, (event?: unknown) => void>(),
  panTo: vi.fn(),
}));

const fakeDiv = vi.hoisted(() => {
  const div = document.createElement('div');
  div.getBoundingClientRect = () =>
    ({
      left: 10,
      top: 20,
      width: 200,
      height: 100,
      right: 210,
      bottom: 120,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    }) as DOMRect;
  return div;
});

const fakeMap = vi.hoisted(() => ({
  addListener: vi.fn((event: string, handler: (event?: unknown) => void) => {
    mocks.listeners.set(event, handler);
    return { event };
  }),
  getBounds: vi.fn(() => ({
    getNorthEast: () => ({ lat: () => 40, lng: () => 130 }),
    getSouthWest: () => ({ lat: () => 30, lng: () => 120 }),
  })),
  getDiv: vi.fn(() => fakeDiv),
  panTo: mocks.panTo,
}));

vi.mock('@vis.gl/react-google-maps', () => ({
  Map: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-google-map={JSON.stringify(props)}>{children}</div>
  ),
  useMap: () => fakeMap,
}));

vi.mock('@/lib/public-runtime-config', () => ({
  getPublicGoogleMapsApiKey: () => mocks.apiKey,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window.navigator, 'vibrate', {
  writable: true,
  value: vi.fn(),
});

globalThis.google = {
  maps: {
    event: {
      removeListener: vi.fn(),
    },
  },
} as never;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
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

let host: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listeners.clear();
  mocks.apiKey = '';
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

function renderMap(props: Partial<React.ComponentProps<typeof BaseMap>> = {}) {
  act(() => {
    root?.render(
      <MantineProvider>
        <BaseMap center={{ lat: 37, lng: 127 }} {...props} />
      </MantineProvider>,
    );
  });
}

describe('BaseMap', () => {
  it('renders an explanatory fallback when the Google Maps key is missing', () => {
    renderMap();

    expect(document.body.textContent).toContain('Google Maps API key not configured');
    expect(document.querySelector('[data-google-map]')).toBeNull();
  });

  it('wires map options, pan targets, mouse clicks, POI clicks, and touch taps', () => {
    mocks.apiKey = 'key';
    const onClick = vi.fn();
    const onPoiClick = vi.fn();

    renderMap({
      zoom: 12,
      panTo: { lat: 38, lng: 128 },
      clickableIcons: true,
      gestureHandling: 'greedy',
      onClick,
      onPoiClick,
      children: <div data-child>Child</div>,
    });

    expect(document.querySelector('[data-child]')).not.toBeNull();
    expect(mocks.panTo).toHaveBeenCalledWith({ lat: 38, lng: 128 });
    expect(fakeMap.addListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(fakeMap.addListener).toHaveBeenCalledWith('mouseup', expect.any(Function));

    const latLng = { lat: () => 37.5, lng: () => 127.5 };
    act(() => {
      mocks.listeners.get('mousedown')?.({ latLng });
      mocks.listeners.get('mouseup')?.({ latLng });
    });
    expect(onClick).toHaveBeenCalledWith(37.5, 127.5);

    act(() => {
      mocks.listeners.get('click')?.({
        placeId: 'place-1',
        latLng,
        stop: vi.fn(),
      });
    });
    expect(onPoiClick).toHaveBeenCalledWith('place-1', 37.5, 127.5);

    act(() => {
      fakeDiv.dispatchEvent(
        new TouchEvent('touchstart', {
          touches: [{ clientX: 110, clientY: 70 } as Touch],
        }),
      );
      fakeDiv.dispatchEvent(new TouchEvent('touchend'));
    });
    expect(onClick).toHaveBeenCalledWith(35, 125);
  });
});
