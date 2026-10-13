import type { Meta, StoryObj } from '@storybook/nextjs';
import { IconAlertTriangle, IconCheck, IconInfoCircle, IconStar, IconX } from '@tabler/icons-react';
import { localizedRender } from '@/.storybook/fixture-i18n';
import { LayoutInline, LayoutStack } from '../Layout';
import { Text } from '../Typography';
import { StatusIcon } from './StatusIcon';

const meta = {
  title: 'Core/Data Display/StatusIcon',
  component: StatusIcon,
  parameters: { layout: 'padded' },
  args: { icon: IconCheck, tone: 'positive' },
  argTypes: { icon: { control: false } },
} satisfies Meta<typeof StatusIcon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Tones: Story = {
  render: localizedRender(() => (
    <LayoutInline gap="lg" wrap="wrap">
      <StatusIcon icon={IconCheck} tone="positive" label="Yes" />
      <StatusIcon icon={IconAlertTriangle} tone="warning" label="Warning" />
      <StatusIcon icon={IconAlertTriangle} tone="danger" label="Error" />
      <StatusIcon icon={IconStar} tone="accent" label="Featured" />
      <StatusIcon icon={IconX} tone="neutral" label="No" />
    </LayoutInline>
  )),
};
export const Sizes: Story = {
  render: () => (
    <LayoutInline gap="lg" align="end">
      <StatusIcon icon={IconInfoCircle} tone="accent" size="sm" />
      <StatusIcon icon={IconInfoCircle} tone="accent" size="md" />
      <StatusIcon icon={IconInfoCircle} tone="accent" size="lg" />
    </LayoutInline>
  ),
};
export const BesideText: Story = {
  render: localizedRender(() => (
    <LayoutStack gap="xs">
      <LayoutInline gap="xs">
        <StatusIcon icon={IconAlertTriangle} tone="warning" />
        <Text size="sm">Add a description for search results.</Text>
      </LayoutInline>
      <LayoutInline gap="xs">
        <StatusIcon icon={IconCheck} tone="positive" />
        <Text size="sm">Slug is available.</Text>
      </LayoutInline>
    </LayoutStack>
  )),
};
