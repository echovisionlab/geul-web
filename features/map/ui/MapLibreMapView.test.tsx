// @vitest-environment jsdom

import { DesignSystemTestProvider as DesignSystemProvider } from '@/test/TestProviders';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  it.each(['light', 'dark'] as const)(
    'preserves provider identity colors and emits directions intents in %s',
    (mode) => {
      const onCloseDirections = vi.fn();
      const onSelectProvider = vi.fn();

      act(() => {
        root.render(
          <DesignSystemProvider forceColorScheme={mode}>
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
              closeDirectionsLabel="Close directions"
              onCloseDirections={onCloseDirections}
              onSelectProvider={onSelectProvider}
              printImageUrl={null}
              printPreviewAlt="Map preview"
              containerRef={() => undefined}
            />
          </DesignSystemProvider>,
        );
      });

      expect(host.querySelector('[data-map-surface]')).not.toBeNull();
      expect(host.textContent).toContain('Map data');
      expect(document.body.textContent).toContain('Directions');
      expect(host.textContent).not.toContain('Loading map');

      const providerButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
        button.textContent?.includes('Google Maps'),
      );
      expect(providerButton?.tagName).toBe('BUTTON');
      expect(providerButton?.type).toBe('button');
      expect([...providerButton!.querySelectorAll('path')].map((path) => path.getAttribute('fill'))).toEqual([
        '#4285F4',
        '#34A853',
        '#FBBC05',
        '#EA4335',
      ]);
      const naverButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
        button.textContent?.includes('Naver Maps'),
      );
      expect(naverButton?.querySelector('svg')?.getAttribute('fill')).toBe('#03C75A');
      act(() => providerButton?.click());
      act(() => document.querySelector<HTMLButtonElement>('button[aria-label="Close directions"]')?.click());

      expect(onSelectProvider).toHaveBeenCalledWith('google');
      expect(onCloseDirections).toHaveBeenCalledOnce();
    },
  );
});
