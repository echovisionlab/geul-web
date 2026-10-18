import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileMediaPreview } from './FileMediaPreview';

const playerMocks = vi.hoisted(() => ({
  audio: vi.fn(),
  video: vi.fn(),
}));

vi.mock('./AudioPlayer', () => ({
  AudioPlayer: (props: Record<string, unknown>) => {
    playerMocks.audio(props);
    return <div data-testid="audio-player" />;
  },
}));

vi.mock('./VideoPlayer', () => ({
  VideoPlayer: (props: Record<string, unknown>) => {
    playerMocks.video(props);
    return <div data-testid="video-player" />;
  },
}));

beforeEach(() => {
  playerMocks.audio.mockReset();
  playerMocks.video.mockReset();
});

describe('FileMediaPreview', () => {
  it('reuses the shared audio player with HLS and waveform but no spectrogram', () => {
    const html = renderToStaticMarkup(
      <FileMediaPreview
        source={{
          fileId: 'audio-1',
          name: 'field-recording.wav',
          mimeType: 'audio/wav',
          originalUrl: '/audio.mp3',
          hlsUrl: '/audio.m3u8',
          waveformUrl: '/waveform.json',
          processingStatus: MediaProcessingStatus.READY,
        }}
      />,
    );

    expect(html).toContain('data-testid="audio-player"');
    expect(playerMocks.audio.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        src: '/audio.mp3',
        hlsSrc: '/audio.m3u8',
        waveformUrl: '/waveform.json',
      }),
    );
    expect(playerMocks.audio.mock.calls[0]?.[0]).not.toHaveProperty('spectrogramSrc');
  });

  it('reuses the shared video player with HLS and poster', () => {
    const html = renderToStaticMarkup(
      <FileMediaPreview
        source={{
          fileId: 'video-1',
          name: 'performance.mp4',
          mimeType: 'video/mp4',
          originalUrl: '/video.mp4',
          hlsUrl: '/video.m3u8',
          posterUrl: '/poster.jpg',
          processingStatus: MediaProcessingStatus.PROCESSING,
        }}
      />,
    );

    expect(html).toContain('data-testid="video-player"');
    expect(playerMocks.video.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        src: '/video.mp4',
        hlsSrc: '/video.m3u8',
        poster: '/poster.jpg',
        isProcessing: true,
      }),
    );
  });
});
