import type { Meta, StoryObj } from '@storybook/nextjs';

import { Stack } from '@mantine/core';
import { Radio } from './Radio';

interface RadioGroupStoryProps {
  defaultValue?: string;
  disabled?: boolean;
  error?: string;
}

function RadioGroupStory({ defaultValue = 'public', disabled = false, error }: RadioGroupStoryProps) {
  return (
    <Radio.Group label="Visibility" defaultValue={defaultValue} error={error} w={320}>
      <Stack mt="xs">
        <Radio value="public" label="Public" disabled={disabled} />
        <Radio value="members" label="Members only" disabled={disabled} />
        <Radio value="private" label="Private" disabled={disabled} />
      </Stack>
    </Radio.Group>
  );
}

const meta = {
  title: 'Core/Input/Radio',
  component: RadioGroupStory,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof RadioGroupStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = { args: { defaultValue: 'members' } };
export const Error: Story = { args: { error: 'Choose a visibility' } };
export const Disabled: Story = {
  args: { defaultValue: 'members', disabled: true },
};
