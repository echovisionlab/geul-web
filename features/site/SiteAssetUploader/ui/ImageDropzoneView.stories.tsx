import type { Meta, StoryObj } from '@storybook/nextjs';
import { ImageDropzoneView } from './ImageDropzoneView';

const meta: Meta<typeof ImageDropzoneView> = {
  title: 'Feature/Site/Asset Upload',
  component: ImageDropzoneView,
  args: {
    currentUrl: null,
    uploading: false,
    deleting: false,
    disabled: false,
    accept: ['image/png'],
    maxSize: 2 * 1024 * 1024,
    previewHeight: 48,
    previewWidth: 'auto',
    label: 'Site logo',
    description: 'Site identity image',
    uploadPrompt: 'Drop or click to upload · PNG',
    loadingLabel: 'Uploading',
    removeButtonAriaLabel: 'Remove site logo',
    onFileSelect: () => {},
    onReject: () => {},
    onDelete: () => {},
  },
};
export default meta;
type Story = StoryObj<typeof ImageDropzoneView>;
export const Default: Story = {};
export const Preparing: Story = { args: { uploading: true, loadingLabel: 'Preparing image' } };
export const Linking: Story = { args: { uploading: true, loadingLabel: 'Loading...' } };
export const Removing: Story = { args: { currentUrl: '/storybook/media/video-poster.jpg', deleting: true } };
