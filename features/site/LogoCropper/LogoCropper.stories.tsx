import type { Meta, StoryObj } from '@storybook/nextjs';
import { LogoCropper } from './LogoCropper';
const meta: Meta<typeof LogoCropper> = {
  title: 'Feature/Site/Logo Cropper',
  component: LogoCropper,
  args: {
    currentImage: null,
    name: 'Studio',
    label: 'Logo',
    onUpload: async () => new Promise<never>(() => {}),
    onDelete: async () => new Promise<never>(() => {}),
    onImageChange: async () => {},
  },
  parameters: {
    docs: {
      description: {
        component:
          'The production controller and Core crop/upload views. A selected image uses the real browser preparation and crop flow. Upload and removal deliberately remain pending in the local fixture; remount the story to reset.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof LogoCropper>;
export const Default: Story = {};
export const ExistingLogo: Story = { args: { currentImage: '/storybook/media/video-poster.jpg' } };
