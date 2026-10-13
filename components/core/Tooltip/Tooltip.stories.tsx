import type { Meta, StoryObj } from '@storybook/nextjs';

import { IconSearch } from '@tabler/icons-react';
import { IconButton } from '../IconButton';
import { OnDemandTooltip } from './OnDemandTooltip';
import { Tooltip } from './Tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Core/Overlays/Tooltip',
  component: Tooltip,
  tags: ['tooltip'],
  parameters: { layout: 'centered' },
  args: { tabIndex: 0 },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  args: {
    label: 'View details',
    children: <span>Hover for details</span>,
  },
};

export const MultilineLongLabel: Story = {
  args: {
    label: 'This longer explanation wraps across multiple lines so dense controls can still provide useful context.',
    multiline: true,
    size: 'compact',
    children: <span>Hover for context</span>,
  },
};

export const Disabled: Story = {
  args: {
    label: 'This tooltip is disabled',
    disabled: true,
    children: <span>Disabled tooltip</span>,
  },
};

export const Opened: Story = {
  args: {
    label: 'Controlled open state',
    opened: true,
    children: <span>Always visible</span>,
  },
};

/**
 * `OnDemandTooltip` for always-present chrome: same props and markup; the positioned surface loads on
 * first hover/focus (Storybook preloads it, so this preview opens like `Tooltip`).
 */
export const OnDemandChromeHint: Story = {
  render: (args) => (
    <OnDemandTooltip label="Search (Ctrl+K)" tabIndex={args.tabIndex}>
      <IconButton size="chrome" aria-label="Search">
        <IconSearch size={16} aria-hidden />
      </IconButton>
    </OnDemandTooltip>
  ),
};
