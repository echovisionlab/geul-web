// @vitest-environment jsdom

import { act, render, screen } from '@/test/render';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_MAP_THEME_LIGHT_CONFIG } from '@/lib/types/map-theme/schema';
import { MapLibreMap } from './MapLibreMap';

const mapBoundary = vi.hoisted(() => ({
  getCenter: () => ({ lat: 37.5, lng: 127 }),
  getZoom: () => 12,
  getPitch: () => 0,
  getBearing: () => 0,
  getContainer: () => document.body,
  getCanvas: () => ({ style: {} }),
  getLayer: () => undefined,
  isStyleLoaded: () => false,
  loaded: () => false,
  on: () => undefined,
  off: () => undefined,
  once: () => undefined,
  touchZoomRotate: { disableRotation: () => undefined },
}));

// MapLibre's browser boundary emits this event when its WebGL constructor fails.
vi.mock('react-map-gl/maplibre', () => ({
  default: ({ onError, onLoad }: { onError: (event: unknown) => void; onLoad: (event: unknown) => void }) => (
    <>
      <button type="button" onClick={() => onError({ target: null, error: new Error('WebGL unavailable') })}>
        Fail map initialization
      </button>
      <button type="button" onClick={() => onError({ target: mapBoundary, error: new Error('Tile unavailable') })}>
        Fail tile request
      </button>
      <button type="button" onClick={() => onLoad({ target: mapBoundary })}>
        Load map
      </button>
    </>
  ),
  Marker: () => null,
  Layer: () => null,
  Source: () => null,
}));

function renderMap() {
  return render(
    <MapLibreMap places={[]} center={{ lat: 37.5, lng: 127 }} zoom={12} themeConfig={INITIAL_MAP_THEME_LIGHT_CONFIG} />,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('public map startup', () => {
  it('reveals a loaded map without waiting for idle and retains it after a tile error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { user } = renderMap();
    await user.click(screen.getByRole('button', { name: 'Load map' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fail tile request' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load map' })).toBeInTheDocument();
  });
  it('ends the loader after a WebGL failure and lets the reader retry initialization', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { user } = renderMap();
    expect(screen.getByRole('status')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fail map initialization' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('The map could not be loaded.');

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fail map initialization' })).toBeInTheDocument();
  });

  it('offers recovery when startup never completes', () => {
    vi.useFakeTimers();
    renderMap();
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('The map could not be loaded.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
