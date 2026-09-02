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
    w: 420,
    'aria-label': 'Publication status',
  },
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = { args: { defaultValue: 'Review' } };
export const FullWidth: Story = { args: { fullWidth: true, w: 560 } };
export const Vertical: Story = { args: { orientation: 'vertical', w: 240 } };
export const Disabled: Story = {
  args: { defaultValue: 'Review', disabled: true },
};
