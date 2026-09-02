// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapBlockHydrator } from './MapBlockHydrator';

const embeddedProps: Array<{ blockAlignment?: string }> = [];

vi.mock('./MapViewEmbedded', () => ({
  MapViewEmbedded: ({
    config,
    blockAlignment,
  }: {
    config: { places: Array<{ name: string }> };
    blockAlignment?: string;
  }) => (
    <div
      data-map-hydrated
      data-block-alignment={blockAlignment}
      ref={() => {
        embeddedProps.push({ blockAlignment });
      }}
    >
      {config.places[0]?.name ?? 'unknown'}
    </div>
  ),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 0);
}

if (!window.cancelAnimationFrame) {
  window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
}

let host: HTMLDivElement | null = null;
let content: HTMLDivElement | null = null;
let root: Root | null = null;

function renderMapMarkup(container: HTMLElement, placeName: string) {
  const mapBlock = document.createElement('div');
  mapBlock.className = 'map-block';
  mapBlock.setAttribute('data-block-alignment', 'center');
  mapBlock.setAttribute(
    'data-map-view-config',
    JSON.stringify({
      center: { lat: 37.5665, lng: 126.978 },
      zoom: 15,
      minZoom: -2,
      maxZoom: 22,
      pitch: 0,
      bearing: 0,
      aspectRatio: '16:9',
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
      places: [
        {
          id: 'place-1',
          name: placeName,
          address: 'Seoul',
          lat: 37.5665,
          lng: 126.978,
        },
      ],
      theme: null,
    }),
  );
  mapBlock.innerHTML = '<p class="map-block__placeholder">[Map: 1 place]</p>';
  container.replaceChildren(mapBlock);
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  embeddedProps.length = 0;
  root = null;
  content = null;
  host = null;
});

describe('MapBlockHydrator', () => {
  it('rehydrates map blocks again when placeholder HTML is reinserted', async () => {
    host = document.createElement('div');
    content = document.createElement('div');
    host.appendChild(content);
    document.body.appendChild(host);
    root = createRoot(host);

    renderMapMarkup(content, 'Initial Place');

    await act(async () => {
      root?.render(<MapBlockHydrator containerRef={{ current: content }} />);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(content.querySelector('[data-map-hydrated]')?.textContent).toBe('Initial Place');
    expect(content.textContent).not.toContain('[Map: 1 place]');

    act(() => {
      renderMapMarkup(content!, 'Replacement Place');
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    });

    expect(content.querySelector('[data-map-hydrated]')?.textContent).toBe('Replacement Place');
    expect(content.textContent).not.toContain('[Map: 1 place]');
    expect(embeddedProps.at(-1)?.blockAlignment).toBe('center');
  });
});
