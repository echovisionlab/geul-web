// @vitest-environment jsdom

import { act, render, screen } from '@/test/render';
import { Component, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GeneralError from '@/app/(general)/error';
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

class RouteBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <GeneralError error={this.state.error} reset={() => this.setState({ error: null })} />
    ) : (
      this.props.children
    );
  }
}

function renderMap() {
  return render(
    <RouteBoundary>
      <MapLibreMap
        places={[]}
        center={{ lat: 37.5, lng: 127 }}
        zoom={12}
        themeConfig={INITIAL_MAP_THEME_LIGHT_CONFIG}
      />
    </RouteBoundary>,
  );
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
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
    const { user } = renderMap();
    await user.click(screen.getByRole('button', { name: 'Load map' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fail tile request' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load map' })).toBeInTheDocument();
  });
  it('routes a WebGL failure through the existing 500 page and its reset action', async () => {
    const { user } = renderMap();
    expect(screen.getByRole('status')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fail map initialization' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('link', { name: 'Go home' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fail map initialization' })).toBeInTheDocument();
  });

  it('routes stalled startup through the existing 500 page', () => {
    vi.useFakeTimers();
    renderMap();
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
