import type { Meta, StoryObj } from '@storybook/nextjs';
import { IconCheck, IconPencil, IconTrash, IconX } from '@tabler/icons-react';
import { Group, Stack, Text } from '@mantine/core';

import type { ControlEmphasis, ControlTone } from '../control-style';
import { IconButton } from './IconButton';

const tones: ControlTone[] = ['accent', 'neutral', 'positive', 'warning', 'danger'];
const emphases: ControlEmphasis[] = ['strong', 'medium', 'low', 'outline'];

const meta: Meta<typeof IconButton> = {
  title: 'Core/IconButton',
  component: IconButton,
  parameters: { layout: 'centered' },
  args: { label: 'Edit', children: <IconPencil size={18} aria-hidden /> },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Quiet: Story = {};
export const Primary: Story = {
  args: {
    tone: 'accent',
    emphasis: 'strong',
    label: 'Confirm',
    children: <IconCheck size={18} aria-hidden />,
  },
};
export const Danger: Story = {
  args: {
    tone: 'danger',
    label: 'Delete',
    children: <IconTrash size={18} aria-hidden />,
  },
};
export const Circular: Story = {
  args: {
    shape: 'circle',
    tone: 'danger',
    emphasis: 'strong',
    label: 'Remove',
    children: <IconX size={18} aria-hidden />,
  },
};
export const Disabled: Story = {
  args: { disabled: true, label: 'Disabled edit' },
};

export const LowEmphasisStates: Story = {
  render: () => (
    <Group gap="xs">
      <IconButton label="Enabled neutral action" emphasis="low">
        <IconPencil size={18} aria-hidden />
      </IconButton>
      <IconButton label="Enabled danger action" tone="danger" emphasis="low">
        <IconTrash size={18} aria-hidden />
      </IconButton>
      <IconButton label="Disabled neutral action" emphasis="low" disabled>
        <IconPencil size={18} aria-hidden />
      </IconButton>
      <IconButton label="Disabled danger action" tone="danger" emphasis="low" disabled>
        <IconTrash size={18} aria-hidden />
      </IconButton>
    </Group>
  ),
};

export const SemanticMatrix: Story = {
  render: () => (
    <Stack gap="sm">
      {tones.map((tone) => (
        <Group key={tone} gap="xs" wrap="nowrap">
          <Text w={64} size="xs" c="dimmed">
            {tone}
          </Text>
          {emphases.map((emphasis) => (
            <IconButton key={emphasis} tone={tone} emphasis={emphasis} label={`${tone} ${emphasis}`}>
              <IconPencil size={18} aria-hidden />
            </IconButton>
          ))}
        </Group>
      ))}
    </Stack>
  ),
};
