import type { Meta, StoryObj } from '@storybook/nextjs';

import { Textarea } from './Textarea';

const meta = {
  title: 'Core/Input/Textarea',
  component: Textarea,
  parameters: { layout: 'centered' },
  args: {
    label: 'Description',
    placeholder: 'Enter a description',
    minRows: 4,
    w: 420,
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: {
    defaultValue: 'A long-form description with enough content to show line wrapping.',
  },
};
export const Error: Story = { args: { error: 'Description is required' } };
export const Autosize: Story = {
  args: {
    autosize: true,
    minRows: 2,
    maxRows: 6,
    defaultValue: 'First line\nSecond line\nThird line',
  },
};
export const Disabled: Story = {
  args: { defaultValue: 'Read-only description', disabled: true },
};
