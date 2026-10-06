import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { ImageUploadCropController, type ImageUploadCropControllerProps } from './ImageUploadCropController';

function InteractiveUploader(props: ImageUploadCropControllerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  return (
    <ImageUploadCropController
      {...props}
      imageUrl={imageUrl}
      onUpload={(blob) => {
        const reader = new FileReader();
        reader.onload = () => setImageUrl(reader.result as string);
        reader.readAsDataURL(blob);
      }}
      onRemove={() => setImageUrl(null)}
    />
  );
}

const meta: Meta<typeof ImageUploadCropController> = {
  title: 'Features/Upload/ImageUploadCropController',
  component: ImageUploadCropController,
  parameters: { layout: 'centered' },
  render: (args) => <InteractiveUploader {...args} />,
  args: {
    imageUrl: null,
    canEdit: true,
    isUploading: false,
    uploadProgress: 0,
    isRemoving: false,
    previewWidth: 420,
    onUpload: () => {},
    onRemove: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof ImageUploadCropController>;

export const FeaturedImage: Story = {};

export const OgBackground: Story = {
  args: { aspectRatio: 1200 / 630, label: 'OG background' },
};

export const SquareArtwork: Story = {
  args: { aspectRatio: 1, label: 'Artwork' },
};
