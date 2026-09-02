import type { Meta, StoryObj } from '@storybook/nextjs';
import { Box } from '@mantine/core';

import { ValidatingTextInput } from './ValidatingTextInput';

const meta: Meta<typeof ValidatingTextInput> = {
  title: 'Core/Input/ValidatingTextInput',
  component: ValidatingTextInput,
  tags: ['nickname-onboarding'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <Box w={420} maw="calc(100vw - 2rem)" p="md">
        <Story />
      </Box>
    ),
  ],
  args: {
    label: 'Nickname',
    placeholder: 'Choose a nickname',
    value: 'FieldRecorder',
    readOnly: true,
  },
};

export default meta;
type Story = StoryObj<typeof ValidatingTextInput>;

export const Idle: Story = { args: { value: '' } };
export const Checking: Story = {
  args: { status: 'checking', description: 'Checking availability…' },
};
export const Available: Story = {
  args: { status: 'valid', description: 'This nickname is available.' },
};
export const Unavailable: Story = {
  args: { status: 'invalid', error: 'This nickname is already in use.' },
};
export const GenericFailure: Story = {
  args: {
    status: 'error',
    error: 'Failed to check nickname availability. Try again.',
  },
};

export const NarrowRequiredChecking: Story = {
  args: {
    value: 'Hong Gildong',
    required: true,
    status: 'checking',
    description: 'Checking availability…',
    w: 260,
  },
};

export const LongChecking: Story = {
  args: {
    value: 'N'.repeat(100),
    required: true,
    status: 'checking',
    description: 'Checking availability…',
    w: 260,
  },
};
