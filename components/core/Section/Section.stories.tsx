import type { Meta, StoryObj } from '@storybook/nextjs';
import { IconChartBar, IconUsers } from '@tabler/icons-react';
import { Group, Stack, Text } from '@mantine/core';
import { ContentCard, ContentCardSection } from './ContentCard';
import { SectionCard } from './SectionCard';
import { StatCard } from './StatCard';

const meta: Meta<typeof SectionCard> = {
  title: 'Core/Section',
  component: SectionCard,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 640 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SectionCard>;

export const SectionCardBasic: Story = {
  render: () => (
    <SectionCard>
      <Stack gap={4}>
        <Text fw={600}>Section title</Text>
        <Text size="sm" c="dimmed">
          Section cards frame related controls without adding domain behavior.
        </Text>
      </Stack>
    </SectionCard>
  ),
};

export const ContentCardWithSection: Story = {
  render: () => (
    <ContentCard withBorder>
      <ContentCardSection p="md" bg="gray.0">
        <Text fw={600}>Header section</Text>
      </ContentCardSection>
      <Stack p="md" gap={4}>
        <Text>Card content</Text>
        <Text size="sm" c="dimmed">
          Content cards keep Mantine card sections available through the Core layer.
        </Text>
      </Stack>
    </ContentCard>
  ),
};

export const StatCardMatrix: Story = {
  render: () => (
    <Group align="stretch">
      <StatCard label="Subscribers" value="1,284" icon={<IconUsers size={18} />} />
      <StatCard
        label="Delivery rate"
        value="98.6%"
        tone="positive"
        icon={<IconChartBar size={18} />}
        description="Last 30 days"
      />
      <StatCard label="Failures" value="12" tone="danger" description="Needs review" />
    </Group>
  ),
};
