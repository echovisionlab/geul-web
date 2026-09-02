import type { Meta, StoryObj } from '@storybook/nextjs';

import { ExternalVideoPlayerView } from './ExternalVideoView';

const LOCAL_IFRAME =
  'data:text/html,%3C!doctype%20html%3E%3Chtml%3E%3Cbody%20style%3D%22margin%3A0%3Bbackground%3A%23111%3Bcolor%3Awhite%3Bdisplay%3Agrid%3Bplace-items%3Acenter%3Bheight%3A100vh%22%3EExternal%20video%20fixture%3C%2Fbody%3E%3C%2Fhtml%3E';

const meta: Meta<typeof ExternalVideoPlayerView> = {
  title: 'Feature/Media/External Video',
  component: ExternalVideoPlayerView,
  tags: ['external-video-player'],
  parameters: { layout: 'padded' },
  args: {
    embedUrl: LOCAL_IFRAME,
    originalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    provider: 'youtube',
    title: 'YouTube video',
    aspectRatio: '16:9',
  },
};
export default meta;
type Story = StoryObj<typeof ExternalVideoPlayerView>;

export const YouTube: Story = {};
export const KeyboardFocusFallback: Story = {};
export const Vimeo: Story = {
  args: {
    provider: 'vimeo',
    originalUrl: 'https://vimeo.com/76979871',
    title: 'Vimeo video',
  },
};
export const Shorts: Story = {
  args: { title: 'YouTube Short', aspectRatio: '9:16' },
};
export const LongCaption: Story = {
  args: {
    caption:
      'A deliberately long localized caption that verifies wrapping below the player without changing the original accessible link fallback.',
  },
};
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
};
export const Print: Story = {
  parameters: { media: 'print' },
};
