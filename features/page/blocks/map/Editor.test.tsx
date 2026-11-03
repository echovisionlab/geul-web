// @vitest-environment jsdom

import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@/test/render';
import { DEFAULT_LIGHT_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';
import { sectionSettingsSchema } from '../section-base-schema';
import { MapCanvasPreview } from './Editor';

const api = vi.hoisted(() => ({ places: vi.fn(), themes: vi.fn(), resolveTheme: vi.fn() }));
vi.mock('@/lib/actions/map-place', () => ({ getMapPlacesByIdsAction: api.places }));
vi.mock('@/lib/actions/map-theme', () => ({
  listMapThemesAction: api.themes,
  resolveMapThemeAction: vi.fn(),
  resolvePublicMapThemeAction: api.resolveTheme,
}));

const gpuMap = vi.hoisted(() => ({
  getCenter: () => ({ lat: 37.5, lng: 127 }),
  getZoom: () => 12,
  getPitch: () => 0,
  getBearing: () => 0,
  easeTo: () => undefined,
  getContainer: () => document.createElement('div'),
  getCanvas: () => ({ style: {} }),
  project: () => ({ x: 0, y: 0 }),
  getLayer: () => undefined,
  isStyleLoaded: () => false,
  loaded: () => false,
  on: () => undefined,
  off: () => undefined,
  once: () => undefined,
  touchZoomRotate: { disableRotation: () => undefined },
}));

vi.mock('react-map-gl/maplibre', () => ({
  default: function GpuMapBoundary({ children, onLoad }: { children: ReactNode; onLoad: (event: unknown) => void }) {
    useEffect(() => {
      onLoad({ target: gpuMap });
      // The GPU constructor emits load once per mounted map.
    }, []);
    return (
      <div role="region" aria-label="GPU map">
        {children}
      </div>
    );
  },
  Marker: ({ children }: { children: ReactNode }) => children,
  Source: ({ children }: { children: ReactNode }) => children,
  Layer: () => null,
}));

const place = { id: 'place-1', name: 'Seoul studio', address: 'Seoul', lat: 37.5, lng: 127 };
const queryKeys = { places: ['mapPlace', 'byIds', ['place-1']], themes: ['mapThemes', 'list'] };
let client: QueryClient;

beforeEach(() => {
  api.places.mockResolvedValue({ ok: true, value: [place] });
  api.themes.mockResolvedValue({ themes: [], defaultMapThemeId: '' });
  api.resolveTheme.mockResolvedValue({
    settings: DEFAULT_THEME_SETTINGS,
    variant: { ...DEFAULT_LIGHT_VARIANT, id: 'default-light' },
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  client?.clear();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

function renderPreview() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <MapCanvasPreview
        sectionId="map-1"
        props={{ mapPlaceIds: 'place-1', caption: 'Studio map', showDirections: 'true' }}
        settings={sectionSettingsSchema.parse({})}
      />
    </QueryClientProvider>,
  );
}

describe('MapCanvasPreview query recovery', () => {
  it.each(['places', 'themes'] as const)(
    'blocks initial loading and failure when required %s are absent',
    async (kind) => {
      let reject!: (error: Error) => void;
      api[kind].mockImplementationOnce(
        () =>
          new Promise((_resolve, fail) => {
            reject = fail;
          }),
      );
      renderPreview();

      expect(screen.getByRole('status', { name: 'Loading...' })).toBeInTheDocument();
      expect(screen.queryByText('No map places selected yet.')).not.toBeInTheDocument();
      expect(screen.queryByText('Studio map')).not.toBeInTheDocument();

      await act(async () => reject(new Error('offline')));

      expect(await screen.findByRole('alert')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'GPU map' })).not.toBeInTheDocument();
      expect(screen.queryByText('Studio map')).not.toBeInTheDocument();
    },
  );

  it.each(['places', 'themes'] as const)(
    'retains the admitted map, caption and controls after a failed %s refetch',
    async (kind) => {
      const { user } = renderPreview();
      const map = await screen.findByRole('region', { name: 'GPU map' });
      const caption = screen.getByText('Studio map');
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Seoul studio' }));
      const dialog = await screen.findByRole('dialog');
      const marker = screen.getByRole('button', { name: 'Seoul studio', hidden: true });
      const directions = within(dialog).getByRole('button', { name: 'Google Maps' });

      api[kind].mockRejectedValueOnce(new Error('offline'));
      await act(async () => {
        await client.invalidateQueries({ queryKey: queryKeys[kind] });
      });

      expect(await screen.findByRole('alert', { hidden: true })).toBeVisible();
      expect(screen.getByRole('region', { name: 'GPU map', hidden: true })).toBe(map);
      expect(screen.getByRole('button', { name: 'Seoul studio', hidden: true })).toBe(marker);
      expect(screen.getByText('Studio map')).toBe(caption);
      expect(screen.getByRole('dialog')).toBe(dialog);
      expect(within(dialog).getByRole('button', { name: 'Google Maps' })).toBe(directions);

      await user.click(within(dialog).getByRole('button', { name: 'Close' }));
      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'GPU map' })).toBe(map);
      expect(screen.getByRole('button', { name: 'Seoul studio' })).toBe(marker);
      expect(api[kind]).toHaveBeenCalledTimes(3);
    },
  );

  it.each(['places', 'themes'] as const)(
    'retains a successful empty places response alongside a failed %s refetch',
    async (kind) => {
      api.places.mockResolvedValue({ ok: true, value: [] });
      const { user } = renderPreview();
      const empty = await screen.findByText('No map places selected yet.');

      api[kind].mockRejectedValueOnce(new Error('offline'));
      await act(async () => {
        await client.invalidateQueries({ queryKey: queryKeys[kind] });
      });

      expect(await screen.findByRole('alert')).toBeVisible();
      expect(screen.getByText('No map places selected yet.')).toBe(empty);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('No map places selected yet.')).toBe(empty);
    },
  );
});
