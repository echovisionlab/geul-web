import type { Meta, StoryObj } from '@storybook/nextjs';
import { MediaImage } from './MediaImage';
const meta = {
  title: 'Core/Media/MediaImage',
  component: MediaImage,
  args: {
    alt: 'Artist cover',
    width: 160,
    height: 160,
    fit: 'cover',
    src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="160" height="160"%3E%3Cpath fill="%23888" d="M0 0h160v160H0z"/%3E%3C/svg%3E',
  },
  argTypes: { fit: { control: 'select', options: ['cover', 'contain', 'fill', 'none', 'scale-down'] } },
} satisfies Meta<typeof MediaImage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Cover: Story = {};
export const Contain: Story = { args: { fit: 'contain', width: 240, height: 160 } };
export const Fallback: Story = {
  args: {
    src: '/missing-image.png',
    fallbackSrc:
      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="160" height="160"%3E%3Cpath fill="%23888" d="M0 0h160v160H0z"/%3E%3C/svg%3E',
  },
};
