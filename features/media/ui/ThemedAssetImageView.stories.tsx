import type { Meta, StoryObj } from '@storybook/nextjs';
import { ThemedAssetImageView } from './ThemedAssetImageView';

const meta = {
  title: 'Feature/Media/ThemedAssetImageView',
  component: ThemedAssetImageView,
  args: {
    src: '/storybook/media/video-poster.jpg',
    alt: 'Example brand asset',
    width: 240,
    height: 80,
  },
} satisfies Meta<typeof ThemedAssetImageView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
