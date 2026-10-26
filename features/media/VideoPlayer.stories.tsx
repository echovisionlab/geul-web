import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect } from 'storybook/test';
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
export const SmallPreview: Story = {
  render: (args) => (
    <section aria-label="Narrow video preview" style={{ width: 288, maxWidth: '100%' }}>
      <VideoPlayer {...args} />
    </section>
  ),
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button');
    const bounds = button.getBoundingClientRect();
    const frame = canvas.getByRole('region', { name: 'Narrow video preview' }).getBoundingClientRect();
    expect(bounds.width).toBeGreaterThanOrEqual(window.matchMedia('(any-pointer: coarse)').matches ? 44 : 40);
    expect(Math.abs(bounds.width - bounds.height)).toBeLessThan(1);
    expect(bounds.width).toBeLessThan(frame.width / 2);
    expect(Math.abs(bounds.x + bounds.width / 2 - (frame.x + frame.width / 2))).toBeLessThan(1);
    expect(Math.abs(bounds.y + bounds.height / 2 - (frame.y + frame.height / 2))).toBeLessThan(1);
  },
};
export const Processing: Story = { args: { isReady: false, isProcessing: true } };
