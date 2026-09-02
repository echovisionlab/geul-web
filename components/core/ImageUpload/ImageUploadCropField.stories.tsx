import type { Meta, StoryObj } from '@storybook/nextjs';

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
  title: 'Core/ImageUpload/ImageUploadCropField',
  component: ImageUploadCropField,
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
    aspectRatio: 1200 / 630,
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
