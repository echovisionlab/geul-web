import { useArgs, useState } from 'storybook/preview-api';
import { Button } from '../Button';
import { MediaImage } from '../MediaImage';
import { LayoutStack } from '../Layout';
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
  title: 'Core/Media/ImageCropper',
  component: ImageCropper,
  render: function CropPreview(args) {
    const [, updateArgs] = useArgs();
    const [cropped, setCropped] = useState<string | null>(null);
    return (
      <LayoutStack gap="sm">
        {!args.opened && <Button onClick={() => updateArgs({ opened: true })}>{args.title}</Button>}
        {cropped && <MediaImage src={cropped} alt={args.labels.previewAlt} width={320} height={240} fit="contain" />}
        <ImageCropper
          {...args}
          onClose={() => updateArgs({ opened: false })}
          onCrop={(blob) =>
            new Promise<void>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                setCropped(String(reader.result));
                resolve();
              };
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            })
          }
        />
      </LayoutStack>
    );
  },
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
    cropAccessibility: {
      labels: {
        cropArea: 'Crop selection',
        nwDragHandle: 'Resize northwest corner',
        nDragHandle: 'Resize north edge',
        neDragHandle: 'Resize northeast corner',
        eDragHandle: 'Resize east edge',
        seDragHandle: 'Resize southeast corner',
        sDragHandle: 'Resize south edge',
        swDragHandle: 'Resize southwest corner',
        wDragHandle: 'Resize west edge',
      },
      describeSelection: ({ x, y, width, height }) =>
        `Left ${Math.round(x)}%, top ${Math.round(y)}%, width ${Math.round(width)}%, height ${Math.round(height)}%`,
      instructions:
        'Move the selection with arrow keys. Focus an edge or corner and use arrow keys to resize. Hold Shift for larger steps.',
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

export const TallArtwork: Story = {
  args: {
    ...Freeform.args,
    imageSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="2400" viewBox="0 0 800 2400">
        <rect width="800" height="2400" fill="#dbe4ff" />
        <circle cx="400" cy="1200" r="300" fill="#228be6" />
      </svg>
    `)}`,
  },
};

export const PanoramicArtwork: Story = {
  args: {
    ...Freeform.args,
    imageSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="3600" height="600" viewBox="0 0 3600 600">
        <rect width="3600" height="600" fill="#dbe4ff" />
        <circle cx="1800" cy="300" r="230" fill="#228be6" />
      </svg>
    `)}`,
  },
};

export const BoundedAspectRatio: Story = {
  args: {
    title: 'Crop gallery image',
    aspectRatio: { min: 9 / 16, max: 16 / 9 },
    circularCrop: false,
  },
};

export const RangeAtImageEdges: Story = {
  args: {
    title: 'Crop artist image',
    imageSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
        <rect width="1000" height="1000" fill="#dbe4ff" />
        <path d="M0 900 H1000 M900 0 V1000" stroke="#e03131" stroke-width="4" />
        <circle cx="500" cy="500" r="300" fill="#228be6" />
        <text x="20" y="960" font-size="32">Bottom 10%</text>
      </svg>
    `)}`,
    aspectRatio: { min: 9 / 16, max: 16 / 9 },
    circularCrop: false,
    helpText:
      'Draw a wide selection below the red line, then resize or use arrow keys. The ratio stays within 9:16–16:9.',
  },
};
