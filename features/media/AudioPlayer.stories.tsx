import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AudioPlayer } from './AudioPlayer';
const meta = {
  title: 'Feature/Media/Audio Player',
  component: AudioPlayer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Actual AudioPlayer and WaveSurfer transport using a local four-second 220 Hz fixture. Theme and locale follow the global toolbar; play, pause, seek, mute, volume and download use production behavior. Network/HLS and uploads are covered by runtime tests, outside this local fixture.',
      },
    },
  },
  args: {
    src: '/storybook-fixtures/media-control-preview.wav',
    duration: 4,
    waveform: Array.from({ length: 64 }, (_, index) => Math.sin(index * 0.7) * 0.7),
  },
} satisfies Meta<typeof AudioPlayer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playback: Story = {};
export const Unavailable: Story = { args: { src: '', waveform: undefined, isReady: false } };
export const Download: Story = {
  args: {
    actions: [
      {
        key: 'download-original',
        label: '220 Hz WAV',
        href: '/storybook-fixtures/media-control-preview.wav',
        download: true,
      },
    ],
  },
};

export const KeyboardSeek: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const position = canvas
      .getAllByRole('slider')
      .find((slider): slider is HTMLInputElement => slider.hasAttribute('data-audio-player-seek'));
    await expect(position).toBeDefined();
    await waitFor(() => expect(position).toBeEnabled());
    await step('Seek exposes the current value while preserving the displayed clock', async () => {
      position!.focus();
      await userEvent.keyboard('{End}');
      await expect(position).toHaveValue('4');
      await expect(position).toHaveAttribute('aria-valuetext', '0:04 / 0:04');
      await userEvent.keyboard('{Home}');
      await expect(position).toHaveValue('0');
      await expect(canvasElement.querySelector('[data-audio-player-current-time]')).toHaveTextContent('0:00');
    });
  },
};
