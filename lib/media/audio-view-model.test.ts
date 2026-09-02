import { describe, expect, it } from 'vitest';
import { resolveAudioViewModel } from './audio-view-model';

describe('resolveAudioViewModel', () => {
  it('uses HLS playback when available without eager download actions', () => {
    const model = resolveAudioViewModel({
      fileId: 'audio-1',
      url: 'https://cdn.example.com/original.wav',
      originalUrl: 'https://cdn.example.com/original.wav',
      hlsUrl: 'https://cdn.example.com/master.m3u8',
      spectrogramUrl: 'https://cdn.example.com/spectrogram.png',
      processingStatus: 'completed',
      waveformUrl: 'https://cdn.example.com/waveform.json',
    });

    expect(model.playbackUrl).toBe('https://cdn.example.com/master.m3u8');
    expect(model.playbackSource).toBe('hls');
    expect(model.isReady).toBe(true);
    expect(model.statusLabel).toBe('Ready');
    expect(model.waveformUrl).toBe('https://cdn.example.com/waveform.json');
    expect(model.actions).toEqual([]);
    expect(model.spectrogramUrl).toBe('https://cdn.example.com/spectrogram.png');
  });

  it('does not expose playback when HLS is missing', () => {
    const model = resolveAudioViewModel({
      fileId: 'audio-2',
      url: 'https://cdn.example.com/original.flac',
      originalUrl: 'https://cdn.example.com/original.flac',
      processingStatus: 'completed',
    });

    expect(model.playbackSource).toBe(null);
    expect(model.playbackUrl).toBe('');
    expect(model.actions).toEqual([]);
  });

  it('does not use original as a playback fallback when HLS is missing', () => {
    const model = resolveAudioViewModel({
      fileId: 'audio-3',
      originalUrl: 'https://cdn.example.com/original.wav',
      processingStatus: 'completed',
    });

    expect(model.playbackSource).toBe(null);
    expect(model.playbackUrl).toBe('');
    expect(model.statusLabel).toBe(null);
  });

  it('uses HLS when available', () => {
    const model = resolveAudioViewModel({
      fileId: 'audio-3b',
      originalUrl: 'https://cdn.example.com/original.wav',
      hlsUrl: 'https://cdn.example.com/master.m3u8',
      processingStatus: 'completed',
    });

    expect(model.playbackSource).toBe('hls');
    expect(model.playbackUrl).toBe('https://cdn.example.com/master.m3u8');
    expect(model.isReady).toBe(true);
  });

  it('exposes aggregate processing status separately from playback labels', () => {
    const model = resolveAudioViewModel({
      fileId: 'audio-4',
      hlsUrl: 'https://cdn.example.com/master.m3u8',
      processingStatus: 'processing',
      processingProgress: '42',
    });

    expect(model.isReady).toBe(false);
    expect(model.statusLabel).toBe('Processing 42%');
  });

  it('keeps the shared name and localized caption as separate fields', () => {
    const model = resolveAudioViewModel({
      fileId: 'audio-5',
      caption: 'Caption body',
      name: 'Field recording',
      hlsUrl: 'https://cdn.example.com/master.m3u8',
      processingStatus: 'completed',
    });

    expect(model.title).toBe('Field recording');
    expect(model.caption).toBe('Caption body');
    expect(model.domAttrs['data-media-name']).toBe('Field recording');
  });

  it('exports an explicit blank canonical name separately from its presentation fallback', () => {
    const model = resolveAudioViewModel({});

    expect(model.title).toBe('Untitled audio');
    expect(model.domAttrs['data-media-name']).toBe('');
  });
});
