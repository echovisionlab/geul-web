import type { Meta, StoryObj } from '@storybook/nextjs';
import { PageLoaderView } from './PageLoaderView';

const meta: Meta<typeof PageLoaderView> = {
  title: 'Core/Feedback/PageLoaderView',
  component: PageLoaderView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A quiet page-sized loading region with an optional configured image and Text xs message. The status name remains available when no image or distinct message exists. Message text has no card/background. Site PageLoader selects the first settings.loader_urls entry consistently across server markup, hydration and navigation, resolves managed URLs through the CDN helper, and preserves GIF/SVG delivery without image optimization. The examples use local image fixtures; authored image motion and backend settings persistence require separate review.',
      },
    },
  },
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
