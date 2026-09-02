import type { Meta, StoryObj } from '@storybook/nextjs';

import { Box, Divider, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { Button } from '../Button';
import { Textarea } from '../Input';
import { Popover } from './Popover';

const meta: Meta<typeof Popover> = {
  title: 'Core/Popover',
  component: Popover,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => (
    <Popover portal={false}>
      <Popover.Target>
        <Button tone="neutral" emphasis="medium">
          Open details
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Text size="sm">A focused surface for supporting information and actions.</Text>
      </Popover.Dropdown>
    </Popover>
  ),
};

export const ControlledOpen: Story = {
  render: () => (
    <Popover open onOpenChange={() => {}} portal={false}>
      <Popover.Target>
        <Button tone="neutral" emphasis="medium">
          Controlled popover
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Text size="sm">The owning feature controls this open state.</Text>
      </Popover.Dropdown>
    </Popover>
  ),
};

export const Compact: Story = {
  render: () => (
    <Popover defaultOpen size="compact" placement="bottom-end" portal={false}>
      <Popover.Target>
        <Button tone="neutral" emphasis="medium">
          Section settings
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Section settings
          </Text>
          <Text size="sm">Compact surfaces fit short forms and local settings.</Text>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  ),
};

export const Wide: Story = {
  render: () => (
    <Popover defaultOpen size="wide" placement="bottom-start" portal={false}>
      <Popover.Target>
        <Button tone="neutral" emphasis="medium">
          Filter fields
        </Button>
      </Popover.Target>
      <Popover.Dropdown padding="none">
        <Group align="stretch" gap={0} wrap="nowrap" mih={240}>
          <Stack gap="xs" w={180} p="sm">
            <Text size="sm" fw={500}>
              Fields
            </Text>
            <Text size="sm">Status</Text>
            <Text size="sm">Created date</Text>
            <Text size="sm">Owner</Text>
          </Stack>
          <Divider orientation="vertical" />
          <Stack gap="xs" p="sm" flex={1}>
            <Text size="sm" fw={500}>
              Status
            </Text>
            <Text size="sm" c="dimmed">
              Configure the selected field in the wider editing panel.
            </Text>
          </Stack>
        </Group>
      </Popover.Dropdown>
    </Popover>
  ),
};

export const LongContent: Story = {
  render: () => (
    <Popover defaultOpen portal={false}>
      <Popover.Target>
        <Button tone="neutral" emphasis="medium">
          Review activity
        </Button>
      </Popover.Target>
      <Popover.Dropdown padding="compact">
        <ScrollArea h={280}>
          <Stack gap="xs">
            {Array.from({ length: 20 }, (_, index) => (
              <Box key={index} py={4}>
                <Text size="sm">Activity item {index + 1}</Text>
                <Text size="xs" c="dimmed">
                  Supporting detail remains readable inside bounded feature content.
                </Text>
              </Box>
            ))}
          </Stack>
        </ScrollArea>
      </Popover.Dropdown>
    </Popover>
  ),
};

export const BottomEndPlacement: Story = {
  render: () => (
    <Popover defaultOpen placement="bottom-end" portal={false}>
      <Popover.Target>
        <Button tone="neutral" emphasis="medium">
          Generate text
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Textarea label="Prompt" minRows={2} />
          <Group justify="flex-end" gap="xs">
            <Button size="xs" tone="neutral" emphasis="low">
              Cancel
            </Button>
            <Button size="xs">Generate</Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  ),
};
