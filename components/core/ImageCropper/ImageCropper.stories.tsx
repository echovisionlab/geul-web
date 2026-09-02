import type { Meta, StoryObj } from '@storybook/nextjs';

import { ImageCropper } from './ImageCropper';

const fixtureImage = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <rect width="1200" height="800" fill="#111827" />
    <rect x="80" y="80" width="1040" height="640" fill="#dbe4ff" />
    <circle cx="600" cy="400" r="230" fill="#228be6" />
    <path d="M160 640 L440 300 L650 540 L820 350 L1040 640 Z" fill="#12b886" />
  </svg>
`)}`;

const meta = {
  title: 'Core/ImageCropper',
  component: ImageCropper,
  tags: ['image-cropper'],
  parameters: { layout: 'fullscreen' },
  args: {
    imageSrc: fixtureImage,
    opened: true,
    onClose: () => {},
    onCrop: () => {},
    title: 'Crop profile image',
    labels: {
      previewAlt: 'Profile image crop preview',
      cancel: 'Cancel',
      confirm: 'Apply crop',
    },
    helpText: 'Move and resize the selection before applying the crop.',
    processingLabel: 'Preparing image',
    maxOutputWidth: 1024,
    maxOutputHeight: 1024,
    outputQuality: 0.85,
  },
} satisfies Meta<typeof ImageCropper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SquareAvatar: Story = {
  args: { aspectRatio: 1, circularCrop: true },
};

export const Landscape: Story = {
  args: {
    title: 'Crop featured image',
    labels: {
      previewAlt: 'Featured image crop preview',
      cancel: 'Cancel',
      confirm: 'Apply crop',
    },
    aspectRatio: 16 / 9,
    circularCrop: false,
    maxOutputWidth: 1920,
    maxOutputHeight: 1080,
  },
};

export const Freeform: Story = {
  args: {
    title: 'Crop artwork',
    aspectRatio: 'free',
    circularCrop: false,
  },
};

export const BoundedAspectRatio: Story = {
  args: {
    title: 'Crop gallery image',
    aspectRatio: { min: 9 / 16, max: 16 / 9 },
    circularCrop: false,
  },
};
