// @vitest-environment jsdom

import { act, render, within } from '@/test/render';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

let host: HTMLDivElement | null = null;
let view: ReturnType<typeof render> | undefined;

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

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  view?.unmount();
  view = undefined;
  host?.remove();
  embeddedProps.length = 0;
  host = null;
  vi.useRealTimers();
});

describe('MapBlockHydrator', () => {
  it('rehydrates map blocks again when placeholder HTML is reinserted', async () => {
    host = document.createElement('div');
    const content = document.createElement('div');
    host.appendChild(content);
    document.body.appendChild(host);
    const controller = document.createElement('div');
    host.appendChild(controller);

    renderMapMarkup(content, 'Initial Place');

    view = render(<MapBlockHydrator containerRef={{ current: content }} />, { container: controller });

    expect(within(content).getByText('Initial Place')).toBeInTheDocument();
    expect(within(content).queryByText('[Map: 1 place]')).not.toBeInTheDocument();

    await act(async () => {
      renderMapMarkup(content, 'Replacement Place');
    });

    await act(async () => vi.advanceTimersToNextFrame());
    expect(within(content).getByText('Replacement Place')).toBeInTheDocument();
    expect(within(content).queryByText('[Map: 1 place]')).not.toBeInTheDocument();
    expect(embeddedProps.at(-1)?.blockAlignment).toBe('center');
  });
});
