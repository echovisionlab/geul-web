import type { Meta, StoryObj } from '@storybook/nextjs';

import { ColorInput } from './ColorInput';

const meta = {
  title: 'Core/Input/ColorInput',
  component: ColorInput,
  parameters: { layout: 'centered' },
  args: {
    label: 'Accent color',
    placeholder: 'Choose a color',
    format: 'hex',
    w: 360,
  },
} satisfies Meta<typeof ColorInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Focused: Story = {};
export const Filled: Story = { args: { defaultValue: '#228be6' } };
export const WithSwatches: Story = {
  args: { swatches: ['#228be6', '#12b886', '#fab005', '#fa5252', '#7950f2'] },
};
export const Error: Story = { args: { error: 'Enter a valid color' } };
export const Disabled: Story = {
  args: { defaultValue: '#228be6', disabled: true },
};
