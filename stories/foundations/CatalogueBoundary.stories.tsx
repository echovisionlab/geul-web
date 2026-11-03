import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { CatalogueLoadError, CatalogueLoadingFallback } from '@/lib/providers/ClientMessagesProvider';

function RetryBoundaryPreview(props: Parameters<typeof CatalogueLoadingFallback>[0]) {
  const [retrying, setRetrying] = useState(false);
  return retrying ? <CatalogueLoadingFallback {...props} /> : <CatalogueLoadError onRetry={() => setRetrying(true)} />;
}

const meta: Meta<typeof CatalogueLoadingFallback> = {
  title: 'Foundations/Catalogue Boundary',
  component: CatalogueLoadingFallback,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Production catalogue fallback views with localized visible text and root-supplied image props, before ManifestProvider exists. ConfiguredLoader uses a static local asset; loaderImageSrc and loaderImageUnoptimized Controls also accept an observed public GIF. Retry demonstrates the error-to-pending view; deferred provider tests cover catalogue completion, locale cancellation and retry recovery.',
      },
    },
  },
  argTypes: {
    loaderImageSrc: { control: 'text' },
    loaderImageUnoptimized: { control: 'boolean' },
  },
  args: { loaderImageUnoptimized: true },
};
export default meta;
type Story = StoryObj<typeof CatalogueLoadingFallback>;

// The global preview supplies the shared theme and selected catalogue.
export const Pending: Story = {};
export const ConfiguredLoader: Story = {
  args: { loaderImageSrc: '/storybook/media/video-poster.jpg' },
};
export const FailedImage: Story = {
  args: { loaderImageSrc: '/storybook/media/missing-loader.gif' },
};
export const Retry: Story = { render: (args) => <RetryBoundaryPreview {...args} /> };
