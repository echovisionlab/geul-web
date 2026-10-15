import type { Meta, StoryObj } from '@storybook/nextjs';

import { NumberInput } from './NumberInput';

const meta = {
  title: 'Core/Input/NumberInput',
  component: NumberInput,
  parameters: { layout: 'centered' },
  args: {
    label: 'Display order',
    placeholder: 'Enter an order',
    min: 0,
  },
} satisfies Meta<typeof NumberInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Focused: Story = {};
export const Filled: Story = { args: { defaultValue: 3 } };
export const Bounded: Story = { args: { defaultValue: 5, min: 1, max: 10 } };
export const Error: Story = {
  args: { error: 'Enter a value between 1 and 10' },
};
export const Disabled: Story = { args: { defaultValue: 3, disabled: true } };
export const ReadOnly: Story = { args: { defaultValue: 3, readOnly: true } };
export const WithoutControls: Story = { args: { defaultValue: 3, hideControls: true } };
