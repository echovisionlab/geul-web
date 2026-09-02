import type { Meta, StoryObj } from '@storybook/nextjs';

import { Stack } from '@mantine/core';
import { Checkbox } from './Checkbox';

const meta = {
  title: 'Core/Input/Checkbox',
  component: Checkbox,
  parameters: { layout: 'centered' },
  args: { label: 'Visible to everyone' },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = { args: { defaultChecked: true } };
export const Indeterminate: Story = { args: { indeterminate: true } };
export const Error: Story = { args: { error: 'This choice is required' } };
export const Disabled: Story = {
  args: { defaultChecked: true, disabled: true },
};

export const Group: Story = {
  render: () => (
    <Checkbox.Group label="Notifications" defaultValue={['releases']}>
      <Stack mt="xs">
        <Checkbox value="releases" label="New releases" />
        <Checkbox value="comments" label="New comments" />
        <Checkbox value="mentions" label="Mentions" />
      </Stack>
    </Checkbox.Group>
  ),
};
