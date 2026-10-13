import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { expect, within, userEvent, waitFor } from 'storybook/test';
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
  title: 'Feature/Upload/ImageUploadCropController',
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
  args: { aspectRatio: 1, label: 'Artwork', uploadType: UploadType.RELEASE_ARTWORK, previewWidth: 180 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('1:1')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /upload details|업로드 정보/i })).not.toBeInTheDocument();
    const input = canvasElement.querySelector<HTMLInputElement>('input[type=file]');
    await expect(input?.accept).toContain('image/heic');
    await expect(input?.accept).toContain('.heic');
    await expect(input?.accept).not.toContain('image/gif');
  },
};

/** Browser processing and crop are real; the fixture keeps output locally and never uploads. */
export const ArtworkLocalPreparation: Story = {
  ...SquareArtwork,
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector<HTMLInputElement>('input[type=file]');
    if (!input) {
      throw new Error('Expected artwork file picker');
    }
    const source = canvasElement.ownerDocument.createElement('canvas');
    source.width = 64;
    source.height = 64;
    const context = source.getContext('2d');
    if (!context) {
      throw new Error('Expected browser image encoder');
    }
    context.fillStyle = '#667788';
    context.fillRect(0, 0, 64, 64);
    const png = await new Promise<Blob>((resolve, reject) =>
      source.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Could not create test image'));
        }
      }, 'image/png'),
    );
    await userEvent.upload(input, new File([png], 'artwork.png', { type: 'image/png' }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog');
    await expect(within(dialog).getByRole('img')).toHaveAttribute('src', expect.stringContaining('data:image/webp'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(canvasElement.querySelector('input[type=file]')).toBeInTheDocument();
  },
};
