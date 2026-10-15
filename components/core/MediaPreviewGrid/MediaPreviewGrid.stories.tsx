import { LayoutStack } from '@/components/core/Layout';
import { ImagePreviewFrame, ImagePreviewHeader } from '@/components/core/ImageUpload';
import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { MediaPreviewGrid } from './MediaPreviewGrid';

const meta: Meta<typeof MediaPreviewGrid> = {
  title: 'Core/Layout/MediaPreviewGrid',
  component: MediaPreviewGrid,
  parameters: { layout: 'padded' },
  render: localizedRender((args) => (
    <MediaPreviewGrid {...args}>
      {['OG Image', 'Featured Image'].map((label) => (
        <LayoutStack gap="xxs" key={label}>
          <ImagePreviewHeader label={label} />
          <ImagePreviewFrame src="/storybook/media/video-poster.jpg" alt={label} aspectRatio="1200 / 630" />
        </LayoutStack>
      ))}
    </MediaPreviewGrid>
  )),
};

export default meta;
type Story = StoryObj<typeof MediaPreviewGrid>;

export const ResponsiveGrid: Story = {};
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
