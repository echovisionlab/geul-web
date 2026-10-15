import type { Meta, StoryObj } from '@storybook/nextjs';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MediaAudioFrame, MediaTransport } from './MediaTransport';
import { MediaWaveformSeek } from './MediaWaveformSeek';
const meta: Meta<typeof MediaTransport> = {
  title: 'Core/Media/MediaControls',
  component: MediaTransport,
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof MediaTransport>;
function Interactive({ disabled = false }: { disabled?: boolean }) {
  const t = useTranslations('editorCommon.media.audioPlayer');
  const [playing, setPlaying] = useState(false),
    [volume, setVolume] = useState(0.75),
    [currentTime, setCurrentTime] = useState(42);
  const waveRef = useRef<HTMLDivElement>(null);
  return (
    <MediaAudioFrame playing={playing} ready={!disabled}>
      <MediaWaveformSeek
        label={t('seekPlayback')}
        currentTime={currentTime}
        duration={120}
        disabled={disabled}
        waveRef={waveRef}
        waveReady={false}
        loading={!disabled}
        onSeek={(time) => setCurrentTime(Math.max(0, Math.min(120, time)))}
        onTogglePlayback={() => setPlaying((value) => !value)}
      />
      <MediaTransport
        labels={{ play: t('play'), pause: t('pause'), mute: t('mute'), unmute: t('unmute'), volume: t('volume') }}
        playing={playing}
        muted={volume === 0}
        volume={volume}
        currentTime={currentTime}
        duration={120}
        playbackDisabled={disabled}
        volumeDisabled={disabled}
        onPlay={() => setPlaying((value) => !value)}
        onMute={() => setVolume((value) => (value === 0 ? 0.75 : 0))}
        onVolumeChange={setVolume}
      />
    </MediaAudioFrame>
  );
}
export const InteractiveTransport: Story = { render: () => <Interactive /> };
export const Disabled: Story = { render: () => <Interactive disabled /> };
