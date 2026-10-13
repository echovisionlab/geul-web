import { useEffect, useState } from 'react';
import { LayoutStack } from '../Layout';
import { Text } from '../Typography';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { localizedRender } from '@/.storybook/fixture-i18n';

import { ImageUploadCropField } from './ImageUploadCropField';

const fixtureImage = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#172554" />
    <circle cx="850" cy="220" r="150" fill="#fbbf24" />
    <path d="M0 520 280 220l220 190 180-140 520 360H0Z" fill="#0f766e" />
  </svg>
`)}`;

const labels = {
  field: 'Cover image',
  imageAlt: 'Cover preview',
  emptyTitle: 'Upload cover image',
  emptyDescription: 'PNG, JPEG or WebP · 20 MB maximum',
  readOnlyDescription: 'No cover image',
  changeHint: 'Click the image to replace it',
  loading: 'Uploading image',
  removeButtonAriaLabel: 'Remove cover image',
  cropTitle: 'Crop cover image',
  cropPreviewAlt: 'Cover crop preview',
  cropCancel: 'Cancel',
  cropConfirm: 'Apply crop',
  cropProcessing: 'Preparing image',
};

const meta: Meta<typeof ImageUploadCropField> = {
  title: 'Core/Media/ImageUploadCropField',
  component: ImageUploadCropField,
  render: localizedRender((args) => {
    const [preview, setPreview] = useState({
      imageUrl: args.imageUrl,
      cropImageSrc: args.cropImageSrc,
      cropOpened: args.cropOpened,
    });
    useEffect(
      () => setPreview({ imageUrl: args.imageUrl, cropImageSrc: args.cropImageSrc, cropOpened: args.cropOpened }),
      [args.imageUrl, args.cropImageSrc, args.cropOpened],
    );
    const updatePreview = (next: Partial<typeof preview>) => setPreview((current) => ({ ...current, ...next }));
    const [error, setError] = useState('');
    const read = (blob: Blob, onRead: (value: string) => void) => {
      const reader = new FileReader();
      reader.onload = () => onRead(String(reader.result));
      reader.onerror = () => setError('Unable to read image');
      reader.readAsDataURL(blob);
    };
    return (
      <LayoutStack gap="xs">
        <ImageUploadCropField
          {...args}
          {...preview}
          onFileSelect={(file) => {
            setError('');
            read(file, (cropImageSrc) => updatePreview({ cropImageSrc, cropOpened: true }));
          }}
          onReject={(rejections) =>
            setError(rejections.map(({ file, reason }) => `${file.name}: ${reason}`).join(', '))
          }
          onRemove={() => updatePreview({ imageUrl: null })}
          onCrop={(blob) =>
            read(blob, (imageUrl) => updatePreview({ imageUrl, cropOpened: false, cropImageSrc: null }))
          }
          onCropClose={() => updatePreview({ cropOpened: false, cropImageSrc: null })}
        />
        {error && (
          <Text role="alert" tone="danger">
            {error}
          </Text>
        )}
      </LayoutStack>
    );
  }),
  parameters: { layout: 'centered' },
  args: {
    imageUrl: null,
    cropImageSrc: null,
    cropOpened: false,
    canEdit: true,
    loading: false,
    removeButtonLoading: false,
    labels,
    accept: ['image/png', 'image/jpeg', 'image/webp'],
    maxSize: 20 * 1024 * 1024,
    previewWidth: 420,
    previewMinHeight: 220,
    aspectRatio: 16 / 9,
    onFileSelect: () => {},
    onReject: () => {},
    onRemove: () => {},
    onCrop: () => {},
    onCropClose: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof ImageUploadCropField>;

export const Empty: Story = {};

export const WithImage: Story = {
  args: { imageUrl: fixtureImage },
};

export const Uploading: Story = {
  args: { loading: true, progress: 42 },
};

export const CropOpen: Story = {
  args: { cropImageSrc: fixtureImage, cropOpened: true },
};

export const CompactSocialCard: Story = {
  args: {
    previewWidth: 164,
    previewMinHeight: undefined,
    aspectRatio: 1200 / 630,
    labels: {
      ...labels,
      field: 'Featured Image',
      emptyDescription: '1200×630\n1.91:1',
      constraints: 'PNG, JPEG or WebP · 20 MB maximum',
      constraintsLabel: 'Upload details',
    },
  },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
