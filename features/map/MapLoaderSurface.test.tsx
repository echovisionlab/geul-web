// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { PageLoader } from '@/features/site/PageLoader';
import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { DEFAULT_SITE_SETTINGS_VIEW } from '@/lib/types/site-setting/config';
import { MapLibreMapView } from './ui/MapLibreMapView';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
describe('Map site loader consumption', () => {
  it('consumes the configured site GIF and compact map status directly without a separate loader surface card', () => {
    act(() =>
      root.render(
        <TestProviders>
          <ManifestProvider
            manifest={{
              settings: {
                ...DEFAULT_SITE_SETTINGS_VIEW,
                favicon_asset_set: null,
                site_og_image_url: null,
                loader_urls: ['https://cdn.fixture.test/loader.gif?version=2'],
              },
              menus: { $typeName: 'api.open.v1.Menus', header: [], secondary: [], footer: [], avatarDropdown: [] },
            }}
          >
            <MapLibreMapView
              height={360}
              backgroundColor="#ffffff"
              mapSurface={<div>Map runtime</div>}
              isReady={false}
              loadingSurface={<PageLoader height="100%" minHeight={0} message="Rendering roads and labels" />}
              attributionItems={[]}
              directions={null}
              closeDirectionsLabel="Close directions"
              onCloseDirections={() => {}}
              onSelectProvider={() => {}}
              printImageUrl={null}
              printPreviewAlt="Map preview"
              containerRef={() => undefined}
            />
          </ManifestProvider>
        </TestProviders>,
      ),
    );
    const surface = host.querySelector('[data-map-loading-surface]')!;
    const loader = surface.querySelector('[data-core-page-loader]')!;
    expect(loader.parentElement).toBe(surface);
    expect(loader).toHaveAccessibleName('Loading...');
    expect(loader.textContent).toBe('Rendering roads and labels');
    expect(loader.querySelector('img')).toHaveAttribute('src', 'https://cdn.fixture.test/loader.gif?version=2');
    expect(loader.querySelector('[data-core-typography="text"]')).toHaveAttribute('data-size', 'xs');
  });
});
