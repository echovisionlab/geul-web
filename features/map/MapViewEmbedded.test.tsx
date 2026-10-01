// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapViewConfig } from '@/lib/types/map/model';
import { MapViewEmbedded } from './MapViewEmbedded';

const mocks = vi.hoisted(() => ({
  themeResolution: {
    config: undefined as unknown,
    isLoading: true,
    isError: false,
  },
  mapRuntimeImportCount: 0,
}));

vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<unknown>) =>
    function DynamicMapMock() {
      void loader().catch(() => undefined);
      return null;
    },
}));

vi.mock('@/features/map/MapLibreMap', () => {
  mocks.mapRuntimeImportCount += 1;
  return { MapLibreMap: () => null };
});

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@mantine/core', () => ({
  Alert: ({ children }: { children: unknown }) => children,
  useComputedColorScheme: () => 'light',
}));

vi.mock('@/features/site/PageLoader', () => ({
  PageLoader: ({ message }: { message: string }) => <div data-map-loading>{message}</div>,
}));

vi.mock('@/hooks/useResolvedMapThemeConfig', () => ({
  useResolvedMapThemeConfig: () => mocks.themeResolution,
}));

vi.mock('@/lib/providers/LocaleProvider', () => ({
  useLocale: () => 'en',
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root | null = null;

const emptyConfig = {
  center: { lat: 37.5, lng: 127.1 },
  zoom: 12,
  minZoom: 3,
  maxZoom: 18,
  pitch: 0,
  bearing: 0,
  aspectRatio: '16:9',
  previewWidth: 100,
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
  places: [],
  theme: null,
} as MapViewConfig;

beforeEach(() => {
  mocks.themeResolution.config = undefined;
  mocks.themeResolution.isLoading = true;
  mocks.themeResolution.isError = false;
  mocks.mapRuntimeImportCount = 0;
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

describe('MapViewEmbedded runtime loading', () => {
  it('starts one runtime import only for a used map and overlaps it with theme resolution', async () => {
    await act(async () => {
      root?.render(<MapViewEmbedded config={emptyConfig} />);
      await Promise.resolve();
    });

    expect(mocks.mapRuntimeImportCount).toBe(0);

    const mapConfig = {
      ...emptyConfig,
      places: [{ id: 'place-1', name: 'Studio', address: 'Seoul', lat: 37.5, lng: 127.1 }],
    } as MapViewConfig;

    await act(async () => {
      root?.render(<MapViewEmbedded config={mapConfig} />);
      await Promise.resolve();
    });

    // The theme query remains unresolved here, so this proves the import starts independently.
    expect(mocks.themeResolution.isLoading).toBe(true);
    expect(mocks.mapRuntimeImportCount).toBe(1);

    mocks.themeResolution.config = {};
    mocks.themeResolution.isLoading = false;

    await act(async () => {
      root?.render(<MapViewEmbedded config={mapConfig} />);
      await Promise.resolve();
    });

    expect(mocks.mapRuntimeImportCount).toBe(1);
  });
});
