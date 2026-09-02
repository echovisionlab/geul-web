import type { Meta, StoryObj } from '@storybook/nextjs';

import { Box, Stack, Text } from '@mantine/core';
import { Tabs } from './Tabs';

function TabsExample({ appearance = 'line' }: { appearance?: 'line' | 'outline' | 'pills' }) {
  return (
    <Tabs value="overview" onChange={() => {}} appearance={appearance}>
      <Tabs.List aria-label="Project views">
        <Tabs.Tab value="overview">Overview</Tabs.Tab>
        <Tabs.Tab value="activity">Activity</Tabs.Tab>
        <Tabs.Tab value="settings">Settings</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="overview" pt="md">
        Overview content
      </Tabs.Panel>
      <Tabs.Panel value="activity" pt="md">
        Activity content
      </Tabs.Panel>
      <Tabs.Panel value="settings" pt="md">
        Settings content
      </Tabs.Panel>
    </Tabs>
  );
}

const meta: Meta<typeof Tabs> = {
  title: 'Core/Tabs',
  component: Tabs,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Box w={480} maw="90vw">
      <TabsExample />
    </Box>
  ),
};

export const Appearances: Story = {
  render: () => (
    <Stack w={560} maw="90vw" gap="xl">
      {(['line', 'outline', 'pills'] as const).map((appearance) => (
        <Box key={appearance}>
          <Text size="xs" c="dimmed" mb="xs">
            {appearance}
          </Text>
          <TabsExample appearance={appearance} />
        </Box>
      ))}
    </Stack>
  ),
};
