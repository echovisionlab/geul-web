import type { Meta, StoryObj } from '@storybook/nextjs';

import { MapLibreMapView } from './MapLibreMapView';

const meta: Meta<typeof MapLibreMapView> = {
  title: 'Feature/Map/MapLibreMapView',
  component: MapLibreMapView,
  tags: ['surface-fixture'],
  parameters: { layout: 'fullscreen' },
  args: {
    height: 420,
    backgroundColor: '#e2e8f0',
    mapSurface: (
      <div
        style={{
          display: 'grid',
          width: '100%',
          height: '100%',
          placeItems: 'center',
          background: 'linear-gradient(135deg, #dbeafe, #dcfce7)',
        }}
      >
        Map runtime slot
      </div>
    ),
    isReady: true,
    loadingSurface: <div>Loading map…</div>,
    attributionItems: [
      { label: '© OpenMapTiles', href: 'https://openmaptiles.org' },
      {
        label: '© OpenStreetMap contributors',
        href: 'https://www.openstreetmap.org/copyright',
      },
    ],
    directions: {
      title: 'Directions',
      options: [
        { id: 'google', label: 'Google Maps', icon: 'google' },
        { id: 'naver', label: 'Naver Maps', icon: 'naver' },
      ],
    },
    onCloseDirections: () => {},
    onSelectProvider: () => {},
    backdropZIndex: 10,
    modalZIndex: 11,
    printImageUrl: null,
    printPreviewAlt: 'Map preview',
    containerRef: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof MapLibreMapView>;

export const Directions: Story = {};

export const Loading: Story = {
  args: {
    isReady: false,
    directions: null,
  },
};
