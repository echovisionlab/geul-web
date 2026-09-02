import type { Meta, StoryObj } from '@storybook/nextjs';

import { Group } from '@mantine/core';
import { ImageUploadField } from './ImageUploadField';

const previewImage = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
    <rect width="640" height="360" fill="#18252b"/>
    <path d="M0 250 150 110l105 94 90-72 295 228H0Z" fill="#5a8588"/>
    <circle cx="510" cy="88" r="44" fill="#d9b66f"/>
  </svg>
`)}`;

const meta: Meta<typeof ImageUploadField> = {
  title: 'Core/ImageUpload',
  component: ImageUploadField,
  parameters: { layout: 'centered' },
  args: {
    alt: 'Preview',
    emptyTitle: 'Upload image',
    emptyDescription: 'PNG, JPEG, WebP',
    accept: ['image/png', 'image/jpeg', 'image/webp'],
    maxSize: 20 * 1024 * 1024,
    preview: { mode: 'fixed', width: 360, aspectRatio: '16 / 9', fit: 'cover' },
    placeholder: { width: 360, aspectRatio: '16 / 9' },
    onFileSelect: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof ImageUploadField>;

export const Empty: Story = {};

export const WithImage: Story = {
  args: {
    imageUrl: previewImage,
    changeHint: 'Click image to replace',
    removeButtonAriaLabel: 'Remove image',
    onRemove: () => {},
  },
};

export const Loading: Story = {
  args: { loading: true, loadingLabel: 'Uploading image', progress: 42 },
};

export const Avatar: Story = {
  render: (args) => (
    <Group>
      <ImageUploadField
        {...args}
        imageUrl={null}
        preview={{ mode: 'circle', width: 80, height: 80, fit: 'cover' }}
        placeholder={{
          width: 80,
          height: 80,
          minHeight: 80,
          radius: '50%',
          compact: true,
        }}
      />
      <ImageUploadField
        {...args}
        imageUrl={previewImage}
        removeButtonAriaLabel="Remove avatar"
        onRemove={() => {}}
        preview={{ mode: 'circle', width: 80, height: 80, fit: 'cover' }}
        placeholder={{
          width: 80,
          height: 80,
          minHeight: 80,
          radius: '50%',
          compact: true,
        }}
      />
    </Group>
  ),
};
