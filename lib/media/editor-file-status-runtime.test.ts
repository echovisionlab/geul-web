import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { describe, expect, it } from 'vitest';
import {
  resolveAudioFileStatusRuntime,
  resolveEditorFileStatusRuntime,
  resolveImageFileStatusRuntime,
  resolveVideoFileStatusRuntime,
  type EditorFileStatusSnapshot,
} from './editor-file-status-runtime';

describe('resolveImageFileStatusRuntime', () => {
  it('prefers inline display delivery over the original download delivery', () => {
    expect(
      resolveImageFileStatusRuntime(
        status({
          url: 'https://cdn.example.test/inline',
          originalUrl: 'https://cdn.example.test/download',
        }),
      ),
    ).toEqual({ url: 'https://cdn.example.test/inline' });
  });

  it('falls back to the original delivery when no inline delivery exists', () => {
    expect(resolveImageFileStatusRuntime(status({ originalUrl: 'https://cdn.example.test/download' }))).toEqual({
      url: 'https://cdn.example.test/download',
    });
  });
});

function status(overrides: Partial<EditorFileStatusSnapshot>): EditorFileStatusSnapshot {
  return {
    completed: false,
    failed: false,
    unavailable: false,
    url: '',
    originalUrl: '',
    waveformUrl: '',
    spectrogramUrl: '',
    thumbnailUrl: '',
    hlsUrl: '',
    durationSeconds: 0,
    processingStatus: MediaProcessingStatus.UNSPECIFIED,
    processingPercentage: undefined,
    ...overrides,
  };
}

describe('editor file-status runtime mapping', () => {
  it('maps the complete authoritative delivery for the editor runtime store', () => {
    expect(
      resolveEditorFileStatusRuntime(
        status({
          mimeType: 'audio/wav',
          completed: true,
          processingStatus: MediaProcessingStatus.READY,
          url: 'https://cdn.example.com/inline.wav',
          originalUrl: 'https://cdn.example.com/source.wav',
          hlsUrl: 'https://cdn.example.com/master.m3u8',
          waveformUrl: 'https://cdn.example.com/waveform.json',
          spectrogramUrl: 'https://cdn.example.com/spectrogram.png',
          durationSeconds: 3685,
        }),
      ),
    ).toEqual({
      mimeType: 'audio/wav',
      processingStatus: 'ready',
      processingProgress: '0',
      url: 'https://cdn.example.com/inline.wav',
      originalUrl: 'https://cdn.example.com/source.wav',
      hlsUrl: 'https://cdn.example.com/master.m3u8',
      waveformUrl: 'https://cdn.example.com/waveform.json',
      spectrogramUrl: 'https://cdn.example.com/spectrogram.png',
      thumbnailUrl: '',
      duration: '3685',
    });
  });

  it('does not cache a transiently unavailable delivery', () => {
    expect(resolveEditorFileStatusRuntime(status({ unavailable: true }))).toBeNull();
  });

  it('maps completed audio status into display-only runtime media state', () => {
    expect(
      resolveAudioFileStatusRuntime(
        status({
          completed: true,
          processingStatus: MediaProcessingStatus.READY,
          originalUrl: 'https://cdn.example.com/source.wav',
          hlsUrl: 'https://cdn.example.com/master.m3u8',
          waveformUrl: 'https://cdn.example.com/waveform.json',
          spectrogramUrl: 'https://cdn.example.com/spectrogram.png',
          durationSeconds: 12,
        }),
      ),
    ).toEqual({
      processingStatus: 'ready',
      processingProgress: '0',
      url: 'https://cdn.example.com/source.wav',
      originalUrl: 'https://cdn.example.com/source.wav',
      hlsUrl: 'https://cdn.example.com/master.m3u8',
      waveformUrl: 'https://cdn.example.com/waveform.json',
      spectrogramUrl: 'https://cdn.example.com/spectrogram.png',
      duration: '12',
    });
  });

  it('maps in-flight video status without marking it ready', () => {
    expect(
      resolveVideoFileStatusRuntime(
        status({
          url: 'https://cdn.example.com/source.mov',
          thumbnailUrl: 'https://cdn.example.com/thumb.webp',
          processingStatus: MediaProcessingStatus.PROCESSING,
          processingPercentage: 25,
        }),
      ),
    ).toEqual({
      processingStatus: 'processing',
      processingProgress: '25',
      url: 'https://cdn.example.com/source.mov',
      hlsUrl: '',
      thumbnailUrl: 'https://cdn.example.com/thumb.webp',
      duration: '0',
    });
  });

  it('maps processing audio and video status even before output URLs exist', () => {
    expect(
      resolveAudioFileStatusRuntime(
        status({
          processingStatus: MediaProcessingStatus.PROCESSING,
          processingPercentage: 37,
        }),
      ),
    ).toMatchObject({
      processingStatus: 'processing',
      processingProgress: '37',
      hlsUrl: '',
      waveformUrl: '',
      spectrogramUrl: '',
    });
    expect(
      resolveVideoFileStatusRuntime(
        status({
          processingStatus: MediaProcessingStatus.PROCESSING,
          processingPercentage: 64,
        }),
      ),
    ).toMatchObject({
      processingStatus: 'processing',
      processingProgress: '64',
      hlsUrl: '',
      thumbnailUrl: '',
    });
  });

  it('maps terminal failure even when no media URLs are available', () => {
    expect(resolveAudioFileStatusRuntime(status({ failed: true }))).toMatchObject({
      processingStatus: 'failed',
      processingProgress: '0',
    });
    expect(resolveVideoFileStatusRuntime(status({ failed: true }))).toMatchObject({
      processingStatus: 'failed',
      processingProgress: '0',
    });
  });

  it('ignores unavailable status snapshots that do not contain renderable media', () => {
    expect(resolveAudioFileStatusRuntime(status({ unavailable: true }))).toBeNull();
    expect(resolveVideoFileStatusRuntime(status({ unavailable: true }))).toBeNull();
  });
});
