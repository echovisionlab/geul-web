import type { Meta, StoryObj } from '@storybook/nextjs';

import { PasswordInput } from './PasswordInput';

const meta = {
  title: 'Core/Input/PasswordInput',
  component: PasswordInput,
  parameters: { layout: 'centered' },
  args: {
    label: 'Password',
    placeholder: 'Enter a password',
    w: 360,
  },
} satisfies Meta<typeof PasswordInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = { args: { defaultValue: 'secret-value' } };
export const Error: Story = {
  args: { error: 'Password does not meet the requirements' },
};
export const Disabled: Story = {
  args: { defaultValue: 'secret-value', disabled: true },
};
