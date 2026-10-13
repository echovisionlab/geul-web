import type { Meta, StoryObj } from '@storybook/nextjs';
import { VideoPlayer } from './VideoPlayer';
const meta = {
  title: 'Feature/Media/Video Player',
  component: VideoPlayer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Actual VideoPlayer/video.js with a local four-second authored gray-frame fixture. Shared Core controls own transport, popup menus and native settings adapters while video.js retains playback, rate, fullscreen and keyboard behavior. Global theme/locale apply. Processing and chunk-failure/native fallback have production regression tests.',
      },
    },
  },
  args: { src: '/storybook-fixtures/media-control-preview.mp4' },
} satisfies Meta<typeof VideoPlayer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playback: Story = {};
export const Processing: Story = { args: { isReady: false, isProcessing: true } };
