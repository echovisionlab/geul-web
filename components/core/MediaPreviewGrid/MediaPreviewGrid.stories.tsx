import type { Meta, StoryObj } from '@storybook/nextjs';
import { Paper, Text } from '@mantine/core';
import { MediaPreviewGrid } from './MediaPreviewGrid';

const meta: Meta<typeof MediaPreviewGrid> = {
  title: 'Core/Layout/MediaPreviewGrid',
  component: MediaPreviewGrid,
  parameters: { layout: 'padded' },
  render: (args) => (
    <MediaPreviewGrid {...args}>
      {['Image preview', 'Video preview', 'Audio preview'].map((label) => (
        <Paper key={label} bg="gray.1" p="xl" mih={120}>
          <Text>{label}</Text>
        </Paper>
      ))}
    </MediaPreviewGrid>
  ),
};

export default meta;
type Story = StoryObj<typeof MediaPreviewGrid>;

export const ResponsiveGrid: Story = {};
