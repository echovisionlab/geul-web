import { useArgs } from 'storybook/preview-api';
import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { PageLoader } from '@/features/site/PageLoader';
import { ProfileAvatarControl } from './ProfileAvatarControl';
import { useImageCropAccessibility } from '@/lib/i18n/useImageCropAccessibility';

const demoAvatar =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"%3E%3Crect width="256" height="256" fill="%23547985"/%3E%3Ccircle cx="128" cy="91" r="51" fill="%23d9b59a"/%3E%3C/svg%3E';
const labels = {
  alt: 'johndoe',
  upload: 'Upload profile image',
  change: 'Change profile image',
  remove: 'Remove profile image',
  cropTitle: 'Crop profile image',
  cropPreview: 'Profile image crop preview',
  cancel: 'Cancel',
  confirm: 'Confirm',
  preparing: 'Preparing image',
  loadFailed: 'Failed to load data.',
  retry: 'Try again',
};

const meta = {
  title: 'Feature/User/ProfileAvatarControl',
  component: ProfileAvatarControl,
  render: function InteractiveStory(args) {
    const [, updateArgs] = useArgs();
    const cropAccessibility = useImageCropAccessibility(args.labels.cropTitle);
    return (
      <ProfileAvatarControl
        {...args}
        cropAccessibility={cropAccessibility}
        onSave={async (blob) => {
          const imageUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          updateArgs({ imageUrl });
          return true;
        }}
        onRemove={async () => {
          updateArgs({ imageUrl: null });
          return true;
        }}
      />
    );
  },
  parameters: { layout: 'centered' },
  decorators: [
    withFeatureLabels({
      labels: {
        upload: (t) => t('common.actions.uploadItem', { item: t('userAvatar.label') }),
        change: 'common.uploadField.changeHint',
        remove: 'common.actions.remove',
        cropTitle: 'userAvatar.cropTitle',
        cropPreview: 'userAvatar.cropTitle',
        cancel: 'common.actions.cancel',
        confirm: 'common.actions.confirm',
        preparing: 'common.uploadField.status.preparingImage',
        loadFailed: 'common.messages.failedToLoad',
        retry: 'common.actions.tryAgain',
      },
    }),
    (Story) => (
      <div style={{ padding: 'var(--geul-spacing-xl)' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    imageUrl: null,
    size: 80,
    accept: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    maxSize: 20 * 1024 * 1024,
    labels,
    loadingSurface: <PageLoader placement="flow" minHeight={160} size="sm" />,
    onSave: async () => true,
    onRemove: async () => true,
  },
} satisfies Meta<typeof ProfileAvatarControl>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const WithImage: Story = { args: { imageUrl: demoAvatar } };
export const AdminWithImage: Story = { args: { imageUrl: demoAvatar, size: 56 } };
export const DisabledWithImage: Story = { args: { imageUrl: demoAvatar, size: 56, disabled: true } };
