import type { Meta, StoryObj } from '@storybook/nextjs';

import { Switch } from './Switch';
import { LayoutStack } from '@/components/core/Layout';

const meta = {
  title: 'Core/Input/Switch',
  component: Switch,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Monochrome on/off switch with a rounded track and circular thumb. The thumb and track transition with the shared slow motion token (300ms ease-out); animate=false and reduced motion disable transitions while preserving focus and selected state. Locale controls the thumb direction.',
      },
    },
  },
  args: { label: 'Enable notifications' },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Compact: Story = { args: { size: 'xs', density: 'compact' } };
export const StateComparison: Story = {
  render: () => (
    <LayoutStack gap="sm" align="start">
      <Switch label="Notifications" density="compact" />
      <Switch label="Notifications" density="compact" defaultChecked />
      <Switch label="Notifications" density="compact" disabled />
      <Switch label="Notifications" density="compact" defaultChecked disabled />
    </LayoutStack>
  ),
};

export const Checked: Story = { args: { defaultChecked: true } };
export const LabelOnLeft: Story = { args: {} };
export const Disabled: Story = {
  args: { defaultChecked: true, disabled: true },
};
export const WithoutMotion: Story = { args: { animate: false } };
export const ReadOnly: Story = { args: { defaultChecked: true, readOnly: true } };
export const StateLabels: Story = { args: { defaultChecked: true, onLabel: 'On', offLabel: 'Off' } };
