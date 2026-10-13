import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MapNavigation } from './MapNavigation';
import { Text } from '../Typography';
const meta: Meta<typeof MapNavigation> = {
  title: 'Core/Navigation/MapNavigation',
  component: MapNavigation,
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof MapNavigation>;
function Interactive() {
  const t = useTranslations('map');
  const labels = useTranslations('common.labels');
  const [zoom, setZoom] = useState(12);
  const [bearing, setBearing] = useState(30);
  return (
    <div style={{ position: 'relative', height: 240, width: 360 }}>
      <Text>
        {zoom} / {bearing}°
      </Text>
      <MapNavigation
        position="top-right"
        labels={{
          group: labels('map'),
          zoomIn: t('accessibility.zoomIn'),
          zoomOut: t('accessibility.zoomOut'),
          resetNorth: t('accessibility.resetNorth'),
        }}
        zoomInDisabled={zoom >= 18}
        zoomOutDisabled={zoom <= 3}
        onZoomIn={() => setZoom((value) => Math.min(18, value + 1))}
        onZoomOut={() => setZoom((value) => Math.max(3, value - 1))}
        onResetNorth={() => setBearing(0)}
      />
    </div>
  );
}
export const CameraCommands: Story = { render: () => <Interactive /> };
