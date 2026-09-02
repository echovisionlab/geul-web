import { describe, expect, it } from 'vitest';
import { resolveVideoViewModel } from './video-view-model';

describe('resolveVideoViewModel', () => {
  it('treats completed hls media as ready', () => {
    const model = resolveVideoViewModel({
      fileId: 'video-1',
      hlsUrl: 'https://cdn.example.com/master.m3u8',
      thumbnailUrl: 'https://cdn.example.com/thumb.webp',
      processingStatus: 'completed',
      name: 'Forest',
      size: '1048576',
    });

    expect(model.isReady).toBe(true);
    expect(model.hlsUrl).toBe('https://cdn.example.com/master.m3u8');
    expect(model.posterUrl).toBe('https://cdn.example.com/thumb.webp');
    expect(model.statusLabel).toBe('Ready');
    expect(model.sizeText).toBe('1.0 MB');
  });

  it('uses client thumbnail while processing when server thumbnail is missing', () => {
    const model = resolveVideoViewModel({
      fileId: 'video-2',
      processingStatus: 'processing',
      processingProgress: '42',
      clientThumbnail: 'data:image/webp;base64,abc',
    });

    expect(model.isProcessing).toBe(true);
    expect(model.isReady).toBe(false);
    expect(model.posterUrl).toBe('data:image/webp;base64,abc');
    expect(model.statusLabel).toBe('Processing 42%');
  });

  it('does not use the original file URL as a playback fallback', () => {
    const model = resolveVideoViewModel({
      fileId: 'video-3',
      url: 'https://cdn.example.com/original.mp4',
      processingStatus: 'processing',
    });

    expect(model.playbackUrl).toBe('');
    expect(model.originalUrl).toBe('https://cdn.example.com/original.mp4');
    expect(model.domAttrs['data-original-url']).toBe('https://cdn.example.com/original.mp4');
  });

  it('does not treat provider pages as legacy playable embeds', () => {
    const model = resolveVideoViewModel({
      url: 'https://www.youtube.com/embed/abc123',
      name: 'External clip',
    });

    expect(model.originalUrl).toBe('https://www.youtube.com/embed/abc123');
    expect(model.isReady).toBe(false);
    expect(model.playbackUrl).toBe('');
  });

  it('keeps the shared name and localized caption as separate fields', () => {
    const model = resolveVideoViewModel({
      fileId: 'video-4',
      caption: 'Caption body',
      name: 'Field recording film',
      hlsUrl: 'https://cdn.example.com/master.m3u8',
      processingStatus: 'completed',
    });

    expect(model.title).toBe('Field recording film');
    expect(model.caption).toBe('Caption body');
    expect(model.domAttrs['data-media-name']).toBe('Field recording film');
  });

  it('exports an explicit blank canonical name separately from its presentation fallback', () => {
    const model = resolveVideoViewModel({});

    expect(model.title).toBe('Untitled video');
    expect(model.domAttrs['data-media-name']).toBe('');
  });
});
