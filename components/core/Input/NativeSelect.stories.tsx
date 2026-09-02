import type { Meta, StoryObj } from '@storybook/nextjs';

import { NativeSelect } from './NativeSelect';

const meta = {
  title: 'Core/Input/NativeSelect',
  component: NativeSelect,
  parameters: { layout: 'centered' },
  args: {
    label: 'Language',
    data: ['English', 'Korean', 'Japanese'],
    w: 360,
  },
} satisfies Meta<typeof NativeSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Focused: Story = {};
export const Selected: Story = { args: { defaultValue: 'Korean' } };
export const Error: Story = { args: { error: 'Choose a language' } };
export const Disabled: Story = {
  args: { defaultValue: 'Korean', disabled: true },
};
