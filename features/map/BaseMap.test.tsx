// @vitest-environment jsdom

import { act, render, screen } from '@/test/render';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BaseMap } from './BaseMap';

const mocks = vi.hoisted(() => ({
  apiKey: '',
  status: 'LOADED',
  ready: true,
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
    <div role="region" aria-label="Google map" data-google-map={JSON.stringify(props)}>
      {children}
    </div>
  ),
  useMap: () => (mocks.ready ? fakeMap : null),
  useApiLoadingStatus: () => mocks.status,
}));

vi.mock('@/lib/public-runtime-config', () => ({
  getPublicGoogleMapsApiKey: () => mocks.apiKey,
}));

let view: ReturnType<typeof render> | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.listeners.clear();
  mocks.apiKey = '';
  mocks.status = 'LOADED';
  mocks.ready = true;
  vi.stubGlobal('google', { maps: { event: { removeListener: vi.fn() } } });
});
afterEach(() => {
  view?.unmount();
  view = undefined;
  vi.unstubAllGlobals();
});
function renderMap(props: Partial<React.ComponentProps<typeof BaseMap>> = {}) {
  const element = <BaseMap center={{ lat: 37, lng: 127 }} {...props} />;
  if (view) {
    view.rerender(element);
  } else {
    view = render(element);
  }
}

describe('BaseMap', () => {
  it('renders an explanatory fallback when the Google Maps key is missing', () => {
    renderMap();

    expect(screen.getByText('Google Maps API key not configured')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Google map' })).not.toBeInTheDocument();
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

    expect(screen.getByText('Child')).toBeInTheDocument();
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

it('keeps initial SDK and map creation visible until ready', () => {
  mocks.apiKey = 'key';
  mocks.status = 'LOADING';
  mocks.ready = false;
  renderMap();
  expect(screen.getByRole('status')).toHaveTextContent('Unfolding the atlas...');
  mocks.status = 'LOADED';
  renderMap();
  expect(screen.getByRole('status')).toBeInTheDocument();
  mocks.ready = true;
  renderMap();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it.each(['FAILED', 'AUTH_FAILURE'])('ends the SDK wait on %s', (status) => {
  mocks.apiKey = 'key';
  mocks.status = status;
  mocks.ready = false;
  renderMap();
  expect(screen.getByRole('alert')).toHaveTextContent('Failed to load data.');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
