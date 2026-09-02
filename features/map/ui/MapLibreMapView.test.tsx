// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { MapLibreMapView } from './MapLibreMapView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('MapLibreMapView', () => {
  it('renders supplied map copy and emits directions intents', () => {
    const onCloseDirections = vi.fn();
    const onSelectProvider = vi.fn();

    act(() => {
      root.render(
        <MantineProvider>
          <MapLibreMapView
            height={360}
            backgroundColor="#ffffff"
            mapSurface={<div data-map-surface>Map runtime</div>}
            isReady
            loadingSurface={<div>Loading map</div>}
            attributionItems={[{ label: 'Map data', href: 'https://example.com/map-data' }]}
            directions={{
              title: 'Directions',
              options: [
                { id: 'google', label: 'Google Maps', icon: 'google' },
                { id: 'naver', label: 'Naver Maps', icon: 'naver' },
              ],
            }}
            onCloseDirections={onCloseDirections}
            onSelectProvider={onSelectProvider}
            backdropZIndex={10}
            modalZIndex={11}
            printImageUrl={null}
            printPreviewAlt="Map preview"
            containerRef={() => undefined}
          />
        </MantineProvider>,
      );
    });

    expect(host.querySelector('[data-map-surface]')).not.toBeNull();
    expect(host.textContent).toContain('Map data');
    expect(host.textContent).toContain('Directions');
    expect(host.textContent).not.toContain('Loading map');

    const providerButton = [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('Google Maps'),
    );
    expect(providerButton?.tagName).toBe('BUTTON');
    expect(providerButton?.type).toBe('button');
    expect(providerButton?.dataset.fullWidth).toBe('true');
    act(() => providerButton?.click());
    act(() => host.querySelector<HTMLElement>('.mgl-directions-modal__backdrop')?.click());

    expect(onSelectProvider).toHaveBeenCalledWith('google');
    expect(onCloseDirections).toHaveBeenCalledOnce();
  });
});
