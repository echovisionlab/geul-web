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

const playbackLabels = { play: 'Play YouTube video', notice: 'Playing loads it from YouTube.' };

/** Without consent the stored thumbnail stands in; pressing play starts that one player. */
export const WaitingForConsent: Story = {
  args: { consented: false, thumbnailUrl: '/storybook/media/video-poster.jpg', playbackLabels },
};
export const WaitingForConsentWithoutThumbnail: Story = {
  args: { consented: false, thumbnailUrl: null, playbackLabels },
};
export const ShortsWaitingForConsent: Story = {
  args: { consented: false, aspectRatio: '9:16', thumbnailUrl: '/storybook/media/video-poster.jpg', playbackLabels },
};

/** At a small block width the play control shrinks and the notice is dropped. */
export const NarrowWaitingForConsent: Story = {
  args: { consented: false, thumbnailUrl: '/storybook/media/video-poster.jpg', playbackLabels },
  decorators: [
    (Story) => (
      <div style={{ width: 200 }}>
        <Story />
      </div>
    ),
  ],
};
