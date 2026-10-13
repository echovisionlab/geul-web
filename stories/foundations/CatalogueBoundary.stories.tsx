import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { CatalogueLoadError, CatalogueLoadingFallback } from '@/lib/providers/ClientMessagesProvider';

function RetryBoundaryPreview() {
  const [retrying, setRetrying] = useState(false);
  return retrying ? <CatalogueLoadingFallback /> : <CatalogueLoadError onRetry={() => setRetrying(true)} />;
}

const meta: Meta = {
  title: 'Foundations/Catalogue Boundary',
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

// These are the actual production fallback views. The global preview supplies
// the same shared theme and selected catalogue; no story provider overrides them.
export const Pending: Story = {
  render: () => <CatalogueLoadingFallback />,
};
export const ConfiguredLoader: Story = {
  render: () => <CatalogueLoadingFallback loaderImageSrc="/storybook/media/video-poster.jpg" loaderImageUnoptimized />,
};
export const Retry: Story = {
  render: () => <RetryBoundaryPreview />,
};
