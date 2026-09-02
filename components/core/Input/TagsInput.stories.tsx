import type { Meta, StoryObj } from '@storybook/nextjs';

import { TagsInput } from './TagsInput';

const meta = {
  title: 'Core/Input/TagsInput',
  component: TagsInput,
  parameters: { layout: 'centered' },
  args: {
    label: 'Keywords',
    placeholder: 'Add a keyword',
    w: 420,
  },
} satisfies Meta<typeof TagsInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Focused: Story = {};

export const Filled: Story = {
  args: { defaultValue: ['ambient', 'installation'] },
};
export const Limited: Story = {
  args: { defaultValue: ['ambient', 'installation'], maxTags: 3 },
};
export const Error: Story = { args: { error: 'Add at least one keyword' } };
export const Disabled: Story = {
  args: { defaultValue: ['ambient', 'installation'], disabled: true },
};
