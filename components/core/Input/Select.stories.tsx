import type { Meta, StoryObj } from '@storybook/nextjs';
import { Select } from './Select';

const data = ['Draft', 'Published', 'Archived'];

const meta = {
  title: 'Core/Input/Select',
  component: Select,
  parameters: { layout: 'centered' },
  args: {
    label: 'Status',
    placeholder: 'Choose a status',
    data,
    w: 360,
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Selected: Story = { args: { defaultValue: 'Published' } };
export const Searchable: Story = { args: { searchable: true } };
export const Error: Story = { args: { error: 'Choose a status' } };
export const Disabled: Story = { args: { defaultValue: 'Archived', disabled: true } };
