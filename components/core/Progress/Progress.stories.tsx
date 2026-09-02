import type { Meta, StoryObj } from '@storybook/nextjs';

import { Stack, Text } from '@mantine/core';
import { Progress } from './Progress';

const meta = {
  title: 'Core/Progress',
  component: Progress,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ width: 420, maxWidth: 'calc(100vw - 32px)' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    value: 42,
    'aria-label': 'Processing files',
  },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Determinate: Story = {};

export const Indeterminate: Story = {
  args: {
    value: null,
    'aria-label': 'Loading audio engine',
  },
};

export const SemanticTones: Story = {
  render: () => (
    <Stack gap="sm">
      {(['accent', 'neutral', 'positive', 'warning', 'danger'] as const).map((tone, index) => (
        <Stack key={tone} gap={4}>
          <Text size="xs" c="dimmed">
            {tone}
          </Text>
          <Progress value={(index + 1) * 16} tone={tone} aria-label={`${tone} progress`} />
        </Stack>
      ))}
    </Stack>
  ),
};
