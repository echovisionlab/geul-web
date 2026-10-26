import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect } from 'storybook/test';
import { DEFAULT_DARK_VARIANT, DEFAULT_LIGHT_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';
import { MapViewEmbedded } from './MapViewEmbedded';

const meta = {
  title: 'Feature/Map/Embedded',
  component: MapViewEmbedded,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Production embedded map with an explicit fixture theme. Display size controls the share of the parent width; the 70dvh height cap does not narrow the map. MapLibre and browser graphics support are real; feature queries and server persistence are outside this fixture.',
      },
    },
  },
  decorators: [
    (Story) => {
      const [client] = useState(() => new QueryClient());
      return (
        <QueryClientProvider client={client}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
  args: {
    allowEmpty: true,
    config: {
      center: { lat: 37.5, lng: 127 },
      zoom: 12,
      minZoom: 1,
      maxZoom: 20,
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
      theme: {
        id: 'embedded-fixture',
        settings: DEFAULT_THEME_SETTINGS,
        lightVariant: DEFAULT_LIGHT_VARIANT,
        darkVariant: DEFAULT_DARK_VARIANT,
      },
    },
  },
} satisfies Meta<typeof MapViewEmbedded>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullWidth: Story = {
  render: (args) => (
    <section aria-label="Embedded map example">
      <MapViewEmbedded {...args} />
    </section>
  ),
  play: async ({ canvas }) => {
    const parent = canvas.getByRole('region', { name: 'Embedded map example' });
    const frame = parent.firstElementChild!;
    expect(Math.abs(frame.getBoundingClientRect().width - parent.getBoundingClientRect().width)).toBeLessThan(1);
  },
};
