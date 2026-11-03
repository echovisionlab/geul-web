import { useEffect, useState } from 'react';
import { Text } from '../Typography';
import { LayoutStack } from '../Layout';
import { LayoutInline as StoryLayoutInline } from '@/components/core/Layout';
import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, userEvent, within } from 'storybook/test';

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
        removeButtonAppearance="avatar"
        removeButtonPlacement="inside"
        removeButtonEmphasis="strong"
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

export const AvatarRemovalComparison: Story = {
  render: localizedRender((args) => (
    <LayoutStack gap="xl">
      {([56, 80] as const).map((size) => (
        <StoryLayoutInline key={size} gap="xl">
          {(['default', 'avatar'] as const).map((appearance) => (
            <LayoutStack key={appearance} gap="xs">
              <Text size="sm">{`${size}px / ${appearance === 'default' ? 'Before' : 'After'}`}</Text>
              <UploadPreview
                {...args}
                imageUrl={previewImage}
                removeButtonAriaLabel={`Remove ${size}px ${appearance} avatar`}
                removeButtonAppearance={appearance}
                removeButtonPlacement="inside"
                removeButtonEmphasis="strong"
                preview={{ mode: 'circle', width: size, height: size, fit: 'cover' }}
              />
            </LayoutStack>
          ))}
        </StoryLayoutInline>
      ))}
    </LayoutStack>
  )),
};

export const AvatarRemovalStates: Story = {
  args: { onRemove: fn() },
  render: localizedRender((args) => (
    <LayoutStack gap="xl">
      {([56, 80] as const).map((size) => (
        <StoryLayoutInline key={size} gap="xl">
          {(['enabled', 'disabled', 'loading'] as const).map((state) => (
            <LayoutStack key={state} gap="xs">
              <Text size="sm">{`${size}px / ${state}`}</Text>
              <ImageUploadField
                {...args}
                imageUrl={previewImage}
                removeButtonAriaLabel={`Remove ${size}px ${state} avatar`}
                removeButtonAppearance="avatar"
                removeButtonPlacement="inside"
                removeButtonEmphasis="strong"
                removeButtonLoading={state === 'loading'}
                disabled={state === 'disabled'}
                preview={{ mode: 'circle', width: size, height: size, fit: 'cover' }}
              />
            </LayoutStack>
          ))}
        </StoryLayoutInline>
      ))}
    </LayoutStack>
  )),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const enabled = canvas.getByRole('button', { name: 'Remove 56px enabled avatar' });
    const disabled = canvas.getByRole('button', { name: 'Remove 56px disabled avatar' });
    const pending = canvas.getByRole('button', { name: 'Remove 56px loading avatar' });
    for (const size of [56, 80]) {
      const remove = canvas.getByRole('button', { name: `Remove ${size}px enabled avatar` });
      const visual = remove.firstElementChild;
      await expect(visual?.getBoundingClientRect().width).toBe(16);
      await expect(visual?.getBoundingClientRect().height).toBe(16);
      await expect(visual?.firstElementChild?.getBoundingClientRect().width).toBe(12);
      const target = window.matchMedia('(any-pointer: coarse)').matches ? 44 : 24;
      await expect(remove.getBoundingClientRect().width).toBe(target);
      await expect(remove.getBoundingClientRect().height).toBe(target);
      await expect(getComputedStyle(remove).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      // Hit-test the painted corner that used to fall outside the circular native target.
      remove.scrollIntoView({ block: 'nearest' });
      const badge = visual!.getBoundingClientRect();
      const edgeX = getComputedStyle(remove).direction === 'rtl' ? badge.left + 3 : badge.right - 3;
      const edgeTarget = canvasElement.ownerDocument.elementFromPoint(edgeX, badge.top + 3);
      await expect(edgeTarget).toBe(remove);
      await userEvent.click(edgeTarget as HTMLElement);
      await userEvent.hover(remove);
      await expect(getComputedStyle(remove).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      await userEvent.unhover(remove);
    }
    await expect(args.onRemove).toHaveBeenCalledTimes(2);
    await userEvent.click(enabled);
    await userEvent.keyboard('{Enter}');
    await expect(enabled).toHaveFocus();
    await expect(args.onRemove).toHaveBeenCalledTimes(4);
    await expect(disabled).toBeDisabled();
    await expect(pending).toHaveAttribute('aria-busy', 'true');
    await expect(canvas.getByRole('progressbar', { name: 'Remove 56px loading avatar' })).toBeVisible();
    await userEvent.click(disabled);
    await userEvent.click(pending);
    await expect(args.onRemove).toHaveBeenCalledTimes(4);
  },
};
