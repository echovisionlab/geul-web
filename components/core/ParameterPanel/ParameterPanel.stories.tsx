import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ParameterPanel, parameterGroup, parameterAction } from './ParameterPanel';
const meta: Meta<typeof ParameterPanel> = {
  title: 'Core/Input/ParameterPanel',
  component: ParameterPanel,
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof ParameterPanel>;
function Interactive() {
  const t = useTranslations('mapControls');
  const [zoom, setZoom] = useState(12);
  const [rotate, setRotate] = useState(false);
  const [color, setColor] = useState({ r: 118, g: 118, b: 118, a: 0.7 });
  return (
    <ParameterPanel
      title={t('settingsTitle')}
      copyLabel={(label) => t('copyValueTitle', { label })}
      model={{
        [t('folders.camera')]: parameterGroup(
          {
            zoom: {
              kind: 'number',
              label: t('fields.zoom'),
              value: zoom,
              min: 0,
              max: 20,
              step: 0.1,
              onChange: setZoom,
            },
          },
          { collapsed: false },
        ),
        [t('folders.display')]: parameterGroup(
          {
            autoRotate: { kind: 'checkbox', label: t('fields.autoRotate'), value: rotate, onChange: setRotate },
            color: { kind: 'color', label: t('fields.colorScheme'), value: color, onChange: setColor },
          },
          { collapsed: false },
        ),
        [t('scheme.auto')]: parameterAction(() => {
          setZoom(12);
          setRotate(false);
        }),
      }}
    />
  );
}
export const InteractiveParameters: Story = { render: () => <Interactive /> };
