import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, waitFor, within } from 'storybook/test';
import { useTranslations } from 'next-intl';
import { loadClientMessagesForLocale } from '@/lib/i18n/client-message-loaders';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { VideoPlayerView } from './ui/VideoPlayerView';
import { PageLoader } from '@/features/site/PageLoader';
import { VideoPlayer } from './VideoPlayer';
import { MediaPlayerStatusOverlay } from './ui/MediaPlayerStatusOverlay';
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
  play: async ({ canvas, globals }) => {
    const locale = normalizeLocale(globals.locale) ?? DEFAULT_LOCALE;
    const messages = await loadClientMessagesForLocale(locale);
    await waitFor(() => {
      const button = canvas.getByRole('button', { name: messages.editorCommon.media.videoPlayer.play });
      const bounds = button.getBoundingClientRect();
      const frame = canvas.getByRole('region', { name: 'Narrow video preview' }).getBoundingClientRect();
      expect(bounds.width).toBeGreaterThanOrEqual(window.matchMedia('(any-pointer: coarse)').matches ? 44 : 40);
      expect(Math.abs(bounds.width - bounds.height)).toBeLessThan(1);
      expect(bounds.width).toBeLessThan(frame.width / 2);
      expect(Math.abs(bounds.x + bounds.width / 2 - (frame.x + frame.width / 2))).toBeLessThan(1);
      expect(Math.abs(bounds.y + bounds.height / 2 - (frame.y + frame.height / 2))).toBeLessThan(1);
    });
  },
};
export const Processing: Story = {
  args: { isReady: false, isProcessing: true },
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() => {
      const frame = canvasElement.querySelector<HTMLElement>('[data-video-player-processing="true"]');
      expect(frame).not.toBeNull();
      expect(frame!.getBoundingClientRect().height).toBeGreaterThan(0);
      expect(canvas.getByRole('status')).toBeVisible();
      expect(canvas.getByRole('progressbar')).toBeVisible();
      expect(canvasElement.querySelector('[data-core-page-loader]')).toBeNull();
    });
  },
};

function RuntimePreparationPreview({ processing = false }: { processing?: boolean }) {
  const t = useTranslations('editorCommon.media');
  return (
    <VideoPlayerView
      name={t('videoPlayer.regionLabel')}
      preparing
      processing={processing}
      loadingSurface={
        <PageLoader contrast="inverse" minHeight={0} message={t('videoPlayer.controls.videoPlayerLoading')} />
      }
      processingSurface={<MediaPlayerStatusOverlay message={t('videoEditor.processingOverlay')} kind="processing" />}
    />
  );
}

function luminance(color: string) {
  const channels = color
    .match(/[\d.]+/g)!
    .slice(0, 3)
    .map((value) => {
      const channel = Number(value) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export const RuntimePreparation: Story = {
  render: () => <RuntimePreparationPreview />,
  play: async ({ mount, globals }) => {
    const locale = normalizeLocale(globals.locale) ?? DEFAULT_LOCALE;
    const messages = await loadClientMessagesForLocale(locale);
    const labels = messages.editorCommon.media.videoPlayer;
    const canvas = await mount();
    await waitFor(() => {
      const frame = canvas.getByRole('group', { name: labels.regionLabel });
      const status = within(frame).getByRole('status');
      const text = within(status).getByText(labels.controls.videoPlayerLoading);
      const mountNode = frame.querySelector<HTMLElement>('[data-video-player-mount]');
      const bounds = frame.getBoundingClientRect();
      const loadingBounds = status.getBoundingClientRect();
      const textBounds = text.getBoundingClientRect();
      expect(frame).toHaveAttribute('data-video-player-preparing', 'true');
      expect(frame).toHaveAttribute('data-video-player-processing', 'false');
      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeGreaterThan(0);
      expect(Math.abs(bounds.height - (bounds.width * 9) / 16)).toBeLessThan(1);
      expect(mountNode).not.toBeNull();
      expect(Math.abs(mountNode!.getBoundingClientRect().height - bounds.height)).toBeLessThan(1);
      expect(status).toBeVisible();
      expect(text).toBeVisible();
      expect(textBounds.height).toBeGreaterThan(0);
      expect(textBounds.top).toBeGreaterThanOrEqual(bounds.top);
      expect(textBounds.bottom).toBeLessThanOrEqual(bounds.bottom);
      expect(status).toHaveAttribute('data-contrast', 'inverse');
      expect(Math.abs(loadingBounds.height - bounds.height)).toBeLessThan(1);
      expect(Math.abs(loadingBounds.width - bounds.width)).toBeLessThan(1);
      const ink = luminance(getComputedStyle(text).color);
      const background = luminance(getComputedStyle(frame).backgroundColor);
      expect((Math.max(ink, background) + 0.05) / (Math.min(ink, background) + 0.05)).toBeGreaterThanOrEqual(4.5);
      expect(within(frame).queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const processingCanvas = await mount(<RuntimePreparationPreview processing />);
    await waitFor(() => {
      const frame = processingCanvas.getByRole('group', { name: labels.regionLabel });
      expect(frame).toHaveAttribute('data-video-player-preparing', 'true');
      expect(frame).toHaveAttribute('data-video-player-processing', 'true');
      expect(frame.getBoundingClientRect().height).toBeGreaterThan(0);
      expect(within(frame).getAllByRole('status')).toHaveLength(1);
      expect(within(frame).getByRole('progressbar')).toBeVisible();
      expect(within(frame).queryByText(labels.controls.videoPlayerLoading)).not.toBeInTheDocument();
    });
    const restoredCanvas = await mount(<RuntimePreparationPreview />);
    await waitFor(() => expect(restoredCanvas.getByRole('status')).toHaveAttribute('data-contrast', 'inverse'));
  },
};
