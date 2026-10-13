import { useEffect, useState } from 'react';
import { Text } from '../Typography';
import { LayoutStack } from '../Layout';
import { LayoutInline as StoryLayoutInline } from '@/components/core/Layout';
import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { ImageUploadField, type ImageUploadFieldProps } from './ImageUploadField';
function UploadPreview(args: ImageUploadFieldProps) {
  const [imageUrl, setImageUrl] = useState(args.imageUrl);
  const [error, setError] = useState('');
  useEffect(() => setImageUrl(args.imageUrl), [args.imageUrl]);
  return (
    <LayoutStack gap="xs">
      <ImageUploadField
        {...args}
        imageUrl={imageUrl}
        onFileSelect={(file) => {
          setError('');
          const reader = new FileReader();
          reader.onload = () => setImageUrl(String(reader.result));
          reader.onerror = () => setError('Unable to read image');
          reader.readAsDataURL(file);
        }}
        onValidationReject={(rejections) =>
          setError(rejections.map(({ file, reason }) => `${file.name}: ${reason}`).join(', '))
        }
        onRemove={() => setImageUrl(null)}
      />
      {error && (
        <Text role="alert" tone="danger">
          {error}
        </Text>
      )}
    </LayoutStack>
  );
}

const previewImage = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
    <rect width="640" height="360" fill="#18252b"/>
    <path d="M0 250 150 110l105 94 90-72 295 228H0Z" fill="#5a8588"/>
    <circle cx="510" cy="88" r="44" fill="#d9b66f"/>
  </svg>
`)}`;

const meta: Meta<typeof ImageUploadField> = {
  title: 'Core/Media/ImageUploadField',
  component: ImageUploadField,
  parameters: { layout: 'centered' },
  render: localizedRender((args) => <UploadPreview {...args} />),
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
  render: localizedRender((args) => (
    <StoryLayoutInline>
      <UploadPreview
        {...args}
        imageUrl={null}
        preview={{ mode: 'circle', width: 80, height: 80, fit: 'cover' }}
        placeholder={{
          width: 80,
          height: 80,
          minHeight: 80,
          shape: 'circle',
          compact: true,
        }}
      />
      <UploadPreview
        {...args}
        imageUrl={previewImage}
        removeButtonAriaLabel="Remove avatar"
        preview={{ mode: 'circle', width: 80, height: 80, fit: 'cover' }}
        placeholder={{
          width: 80,
          height: 80,
          minHeight: 80,
          shape: 'circle',
          compact: true,
        }}
      />
    </StoryLayoutInline>
  )),
};
