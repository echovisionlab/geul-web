import type { Meta, StoryObj } from '@storybook/nextjs';

import { IconSettings } from '@tabler/icons-react';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { Tooltip } from './Tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Core/Tooltip',
  component: Tooltip,
  tags: ['tooltip'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  args: {
    label: 'View details',
    children: <Button>Hover for details</Button>,
  },
};

export const MultilineLongLabel: Story = {
  args: {
    label: 'This longer explanation wraps across multiple lines so dense controls can still provide useful context.',
    multiline: true,
    w: 240,
    children: <Button tone="neutral">Hover for context</Button>,
  },
};

export const Disabled: Story = {
  args: {
    label: 'This tooltip is disabled',
    disabled: true,
    children: <Button tone="neutral">Disabled tooltip</Button>,
  },
};

export const Opened: Story = {
  args: {
    label: 'Controlled open state',
    opened: true,
    children: <Button tone="neutral">Always visible</Button>,
  },
};

export const IconButtonUsage: Story = {
  args: {
    label: 'Settings',
    children: (
      <IconButton label="Settings">
        <IconSettings size={18} aria-hidden />
      </IconButton>
    ),
  },
};
