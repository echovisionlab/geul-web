import type { Meta, StoryObj } from '@storybook/nextjs';
import { Group, Stack, Text } from '@mantine/core';
import type { ControlEmphasis, ControlTone } from '../control-style';
import { Button } from './Button';

const tones: ControlTone[] = ['accent', 'neutral', 'positive', 'warning', 'danger'];
const emphases: ControlEmphasis[] = ['strong', 'medium', 'low', 'outline'];

const meta: Meta<typeof Button> = {
  title: 'Core/Button',
  component: Button,
  parameters: { layout: 'centered' },
  args: { children: 'Button' },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {};
export const Secondary: Story = {
  args: { tone: 'neutral', emphasis: 'medium', children: 'Secondary' },
};
export const Quiet: Story = {
  args: { tone: 'neutral', emphasis: 'low', children: 'Quiet' },
};
export const Danger: Story = { args: { tone: 'danger', children: 'Delete' } };
export const Loading: Story = { args: { loading: true, children: 'Saving' } };
export const Disabled: Story = { args: { disabled: true, children: 'Disabled' } };

export const SemanticMatrix: Story = {
  render: () => (
    <Stack gap="sm">
      {tones.map((tone) => (
        <Group key={tone} gap="xs" wrap="nowrap">
          <Text w={64} size="xs" c="dimmed">
            {tone}
          </Text>
          {emphases.map((emphasis) => (
            <Button key={emphasis} tone={tone} emphasis={emphasis}>
              {emphasis}
            </Button>
          ))}
        </Group>
      ))}
    </Stack>
  ),
};
