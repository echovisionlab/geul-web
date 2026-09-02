import type { Meta, StoryObj } from '@storybook/nextjs';
import { PageLoaderView } from './PageLoaderView';

const meta: Meta<typeof PageLoaderView> = {
  title: 'Core/Feedback/PageLoaderView',
  component: PageLoaderView,
  parameters: { layout: 'fullscreen' },
  args: {
    height: 240,
    imageAlt: 'Loading',
  },
};

export default meta;
type Story = StoryObj<typeof PageLoaderView>;

export const Default: Story = {};

export const WithMessage: Story = {
  args: {
    message: 'Loading the latest content…',
  },
};

export const WithResolvedImage: Story = {
  args: {
    imageSrc: '/storybook/media/video-poster.jpg',
    message: 'Preparing your workspace…',
  },
};
