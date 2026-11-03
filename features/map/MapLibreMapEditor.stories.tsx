import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { DEFAULT_MAP_CONFIG } from '@/lib/types/map/model';
import { MapLibreMapEditor } from './MapLibreMapEditor';
const meta = {
  title: 'Feature/Map/Editor Preparation',
  component: MapLibreMapEditor,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => {
      const [client] = useState(() => new QueryClient());
      return (
        <QueryClientProvider client={client}>
          <div style={{ height: 320 }}>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  args: { places: [], config: DEFAULT_MAP_CONFIG, onConfigChange: () => {}, resolveTheme: () => new Promise(() => {}) },
} satisfies Meta<typeof MapLibreMapEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ThemePreparation: Story = {};
export const NarrowPreparation: Story = {
  render: (args) => (
    <div style={{ width: 280, maxWidth: '100%', height: 320 }}>
      <MapLibreMapEditor {...args} />
    </div>
  ),
};
