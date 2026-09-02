import type { Meta, StoryObj } from '@storybook/nextjs';
import { Group, Stack } from '@mantine/core';
import type { BadgeTone, StatusTone } from './badge-tones';
import { LabelBadge } from './LabelBadge';
import { StatusBadge } from './StatusBadge';

const badgeTones: BadgeTone[] = ['neutral', 'accent', 'positive', 'warning', 'danger'];

const statusTones: StatusTone[] = ['neutral', 'accent', 'positive', 'warning', 'danger'];

const meta: Meta<typeof LabelBadge> = {
  title: 'Core/Badge',
  component: LabelBadge,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof LabelBadge>;

export const LabelToneMatrix: Story = {
  render: () => (
    <Group>
      {badgeTones.map((tone) => (
        <LabelBadge key={tone} tone={tone}>
          {tone}
        </LabelBadge>
      ))}
    </Group>
  ),
};

export const StatusToneMatrix: Story = {
  render: () => (
    <Stack gap="sm">
      <Group>
        {statusTones.map((tone) => (
          <StatusBadge key={tone} tone={tone}>
            {tone}
          </StatusBadge>
        ))}
      </Group>
      <Group>
        {statusTones.map((tone) => (
          <StatusBadge key={tone} tone={tone} appearance="solid">
            {tone}
          </StatusBadge>
        ))}
      </Group>
    </Stack>
  ),
};
