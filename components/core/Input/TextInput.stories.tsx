import type { Meta, StoryObj } from '@storybook/nextjs';

import { TextInput } from './TextInput';

const meta = {
  title: 'Core/Input/TextInput',
  component: TextInput,
  parameters: { layout: 'centered' },
  args: {
    label: 'Name',
    placeholder: 'Enter a name',
    w: 360,
  },
} satisfies Meta<typeof TextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = { args: { defaultValue: 'Example Studio' } };
export const Error: Story = { args: { error: 'Enter a valid name' } };
export const Disabled: Story = {
  args: { defaultValue: 'Example Studio', disabled: true },
};
export const LongContent: Story = {
  args: {
    label: 'Public display name used throughout administration and publishing',
    defaultValue: 'A deliberately long value that must remain readable without breaking the field',
    w: 280,
  },
};
