import type { Meta, StoryObj } from '@storybook/nextjs';
import { MetadataPair } from './MetadataPair';
import { Text } from '../Typography';

const meta = {
  title: 'Core/Data Display/MetadataPair',
  component: MetadataPair,
  parameters: { layout: 'padded' },
  args: { label: 'Visibility:', children: <Text>Private</Text> },
} satisfies Meta<typeof MetadataPair>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Inline: Story = {};
export const Stacked: Story = {
  args: {
    label: 'Endpoint',
    layout: 'stacked',
    children: (
      <Text font="mono" wrap="anywhere">
        https://example.com/mcp
      </Text>
    ),
  },
};
export const Compact: Story = { args: { size: 'xs' } };
