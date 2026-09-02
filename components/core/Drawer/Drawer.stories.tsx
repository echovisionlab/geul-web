import type { Meta, StoryObj } from '@storybook/nextjs';

import { Loader, Stack, Text } from '@mantine/core';
import { Drawer } from './Drawer';

const meta = {
  title: 'Core/Drawer',
  component: Drawer,
  parameters: { layout: 'fullscreen' },
  args: {
    opened: true,
    onClose: () => {},
    title: 'Panel title',
    closeLabel: 'Close panel',
  },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <Text size="sm">Drawer content supplied by the owning feature.</Text>,
  },
};

export const RightPlacement: Story = {
  args: {
    placement: 'right',
    size: 'compact',
    title: 'Version history',
    closeLabel: 'Close version history',
    children: <Text size="sm">A compact panel anchored to the right edge.</Text>,
  },
};

export const LeftPlacement: Story = {
  args: {
    placement: 'left',
    size: 'standard',
    title: 'Navigation',
    closeLabel: 'Close navigation',
    children: <Text size="sm">A standard panel anchored to the left edge.</Text>,
  },
};

export const LongContent: Story = {
  args: {
    placement: 'right',
    size: 'standard',
    title: 'Activity',
    closeLabel: 'Close activity',
    children: (
      <Stack gap="md">
        {Array.from({ length: 30 }, (_, index) => (
          <Text key={index} size="sm">
            Activity item {index + 1}
          </Text>
        ))}
      </Stack>
    ),
  },
};

export const LoadingNonDismissible: Story = {
  args: {
    loading: true,
    closePolicy: 'non-dismissible',
    title: 'Publishing changes',
    closeLabel: 'Close publishing status',
    children: (
      <Stack align="center" py="xl">
        <Loader size="sm" />
        <Text size="sm">Publishing changes...</Text>
      </Stack>
    ),
  },
};

export const NarrowMobile: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  args: {
    placement: 'bottom',
    size: 'large',
    title: 'Block settings',
    closeLabel: 'Close block settings',
    children: (
      <Stack gap="sm">
        <Text size="sm">Settings remain usable in a narrow viewport.</Text>
        <Text size="sm">The large bottom preset preserves the mobile editing area.</Text>
      </Stack>
    ),
  },
};
