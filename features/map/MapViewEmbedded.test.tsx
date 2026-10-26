// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { render, waitFor } from '@/test/render';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapViewConfig } from '@/lib/types/map/model';
import { MapViewEmbedded } from './MapViewEmbedded';
import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';

const mocks = vi.hoisted(() => ({
  themeResolution: {
    config: undefined as unknown,
    isLoading: true,
    isError: false,
    error: null as Error | null,
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

vi.mock('next-intl', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-intl')>()),
  useTranslations: () => (key: string) => key,
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

const emptyConfig = {
  center: { lat: 37.5, lng: 127.1 },
  zoom: 12,
  minZoom: 3,
  maxZoom: 18,
  pitch: 0,
  bearing: 0,
  aspectRatio: '16:9',
  displaySize: 100,
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
  mocks.themeResolution.error = null;
  mocks.mapRuntimeImportCount = 0;
});

describe('MapViewEmbedded runtime loading', () => {
  it('starts one runtime import only for a used map and overlaps it with theme resolution', async () => {
    const view = render(<MapViewEmbedded config={emptyConfig} />);

    expect(mocks.mapRuntimeImportCount).toBe(0);

    const mapConfig = {
      ...emptyConfig,
      places: [{ id: 'place-1', name: 'Studio', address: 'Seoul', lat: 37.5, lng: 127.1 }],
    } as MapViewConfig;

    view.rerender(<MapViewEmbedded config={mapConfig} />);
    await waitFor(() => expect(mocks.mapRuntimeImportCount).toBe(1));

    // The theme query remains unresolved here, so this proves the import starts independently.
    expect(mocks.themeResolution.isLoading).toBe(true);
    expect(mocks.mapRuntimeImportCount).toBe(1);

    mocks.themeResolution.config = {};
    mocks.themeResolution.isLoading = false;

    view.rerender(<MapViewEmbedded config={mapConfig} />);

    expect(mocks.mapRuntimeImportCount).toBe(1);
  });
  it('preserves full-width map geometry and caption while the theme is loading', () => {
    const html = renderToStaticMarkup(
      <DesignSystemProvider forceColorScheme="light">
        <MapViewEmbedded
          config={{ ...emptyConfig, aspectRatio: '4:3' }}
          allowEmpty
          caption={<span>Map caption</span>}
        />
      </DesignSystemProvider>,
    );
    expect(html).toContain('aspect-ratio:4 / 3');
    // A height cap must not shrink the authored full-width map frame.
    expect(html).toContain('style="width:100%;max-width:100%"');
    expect(html).toContain('loading');
    expect(html).toContain('Map caption');
  });

  it('passes the original theme failure to the application error boundary', () => {
    const failure = Object.assign(new Error('Theme service unavailable'), { status: 503 });
    mocks.themeResolution.isLoading = false;
    mocks.themeResolution.isError = true;
    mocks.themeResolution.error = failure;
    expect(() =>
      renderToStaticMarkup(
        <DesignSystemProvider forceColorScheme="light">
          <MapViewEmbedded config={emptyConfig} allowEmpty />
        </DesignSystemProvider>,
      ),
    ).toThrow(failure);
  });
});
