import type { Meta, StoryObj } from '@storybook/nextjs';

import { IconAlertTriangle, IconCircleCheck, IconInfoCircle, IconX } from '@tabler/icons-react';
import { Group, Stack, Text } from '@mantine/core';
import { Button } from '../Button';
import { Alert } from './Alert';

const onReview = () => {};

const meta: Meta<typeof Alert> = {
  title: 'Core/Alert',
  component: Alert,
  tags: ['alert'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ width: 520, maxWidth: 'calc(100vw - 32px)' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const DefaultInfo: Story = {
  args: {
    icon: <IconInfoCircle size={18} aria-hidden />,
    title: 'Profile information',
    children: 'Changes become visible after the profile is published.',
  },
};

export const Positive: Story = {
  args: {
    icon: <IconCircleCheck size={18} aria-hidden />,
    title: 'Changes saved',
    tone: 'positive',
    children: 'The latest profile details are now available.',
  },
};

export const Warning: Story = {
  args: {
    icon: <IconAlertTriangle size={18} aria-hidden />,
    title: 'Review required',
    tone: 'warning',
    children: 'One or more fields need attention before publishing.',
  },
};

export const Danger: Story = {
  args: {
    icon: <IconX size={18} aria-hidden />,
    title: 'Unable to publish',
    tone: 'danger',
    children: 'Resolve the validation errors and try again.',
  },
};

export const LongContent: Story = {
  args: {
    icon: <IconInfoCircle size={18} aria-hidden />,
    title: 'Before you continue',
    children:
      'Publishing updates every public profile surface. Existing links remain active, but visitors may need to refresh before the latest details appear.',
  },
};

export const WithAction: Story = {
  args: {
    icon: <IconAlertTriangle size={18} aria-hidden />,
    title: 'Unpublished changes',
    tone: 'warning',
    children: (
      <Stack gap="sm">
        <Text size="sm">Review the pending edits before leaving this page.</Text>
        <Group>
          <Button tone="warning" emphasis="outline" onClick={onReview}>
            Review changes
          </Button>
        </Group>
      </Stack>
    ),
  },
};
