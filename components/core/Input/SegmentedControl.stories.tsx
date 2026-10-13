import type { Meta, StoryObj } from '@storybook/nextjs';

import { SegmentedControl } from './SegmentedControl';

const data = ['Draft', 'Review', 'Published'];

const meta = {
  title: 'Core/Input/SegmentedControl',
  component: SegmentedControl,
  parameters: { layout: 'centered' },
  args: {
    data,
    defaultValue: 'Draft',
    'aria-label': 'Publication status',
  },
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Compact: Story = { args: { size: 'xs', density: 'compact' } };

export const Selected: Story = { args: { defaultValue: 'Review' } };
export const FullWidth: Story = { args: { fullWidth: true } };
export const Vertical: Story = { args: { orientation: 'vertical' } };
export const Disabled: Story = {
  args: { defaultValue: 'Review', disabled: true },
};
export const ReadOnly: Story = { args: { defaultValue: 'Review', readOnly: true } };
