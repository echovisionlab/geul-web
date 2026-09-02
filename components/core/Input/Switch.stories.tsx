import type { Meta, StoryObj } from '@storybook/nextjs';

import { Switch } from './Switch';

const meta = {
  title: 'Core/Input/Switch',
  component: Switch,
  parameters: { layout: 'centered' },
  args: { label: 'Enable notifications' },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = { args: { defaultChecked: true } };
export const LabelOnLeft: Story = { args: { labelPosition: 'left' } };
export const Disabled: Story = {
  args: { defaultChecked: true, disabled: true },
};
