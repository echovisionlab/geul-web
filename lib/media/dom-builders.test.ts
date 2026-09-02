// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { resolveAudioViewModel } from './audio-view-model';
import { buildAudioMediaDom, buildVideoMediaDom } from './dom-builders';
import { resolveVideoViewModel } from './video-view-model';

describe('media DOM builders', () => {
  it('builds audio markup with shared contract attrs and actions', () => {
    const dom = buildAudioMediaDom(
      resolveAudioViewModel({
        fileId: 'audio-1',
        originalUrl: 'https://cdn.example.com/original.wav',
        hlsUrl: 'https://cdn.example.com/master.m3u8',
        waveformUrl: 'https://cdn.example.com/waveform.json',
        spectrogramUrl: 'https://cdn.example.com/spectrogram.png',
        name: 'Birdsong',
        caption: 'Dawn chorus recording',
        processingStatus: 'completed',
      }),
    );

    expect(dom.getAttribute('data-media-kind')).toBe('audio');
    expect(dom.getAttribute('data-playback-url')).toBe('https://cdn.example.com/master.m3u8');
    expect(dom.getAttribute('data-waveform-url')).toBe('https://cdn.example.com/waveform.json');
    expect(dom.getAttribute('data-spectrogram-url')).toBe('https://cdn.example.com/spectrogram.png');
    expect(dom.querySelector('audio')?.getAttribute('src')).toBeNull();
    expect(dom.querySelector('[data-audio-player-wave]')).not.toBeNull();
    expect(dom.querySelector('.audio-waveform')).toBeNull();
    expect(dom.querySelector('[data-audio-player-wave-loading="true"]')).not.toBeNull();
    expect(dom.querySelector('.audio-player')).not.toBeNull();
    expect(dom.querySelector('[data-audio-player-view-toggle]')).toBeNull();
    expect(dom.querySelector('[data-audio-player-spectrogram-frame]')).toBeNull();
    expect(dom.querySelector('[data-audio-player-spectrogram-image]')).toBeNull();
    expect(dom.querySelector('[data-audio-player-download]')).toBeNull();
    expect(dom.querySelector('.audio-block__title')?.textContent).toBe('Birdsong');
    expect(dom.getAttribute('data-media-name')).toBe('Birdsong');
    expect(dom.querySelector('.media-block__caption')?.textContent).toBe('Dawn chorus recording');
  });

  it('builds video markup with poster and hls attrs', () => {
    const dom = buildVideoMediaDom(
      resolveVideoViewModel({
        fileId: 'video-1',
        url: 'https://cdn.example.com/original.mp4',
        hlsUrl: 'https://cdn.example.com/master.m3u8',
        thumbnailUrl: 'https://cdn.example.com/thumb.webp',
        name: 'Field recording film',
        caption: 'Shot at sunrise',
        processingStatus: 'completed',
      }),
    );

    expect(dom.getAttribute('data-media-kind')).toBe('video');
    expect(dom.getAttribute('data-original-url')).toBe('https://cdn.example.com/original.mp4');
    expect(dom.getAttribute('data-hls-src')).toBe('https://cdn.example.com/master.m3u8');
    expect(dom.getAttribute('data-poster-url')).toBe('https://cdn.example.com/thumb.webp');
    expect(dom.querySelector('.video-player-container')).not.toBeNull();
    expect(dom.querySelector('video')?.getAttribute('data-hls-src')).toBe('https://cdn.example.com/master.m3u8');
    expect(dom.querySelector('.video-block__title')?.textContent).toBe('Field recording film');
    expect(dom.getAttribute('data-media-name')).toBe('Field recording film');
    expect(dom.querySelector('.media-block__caption')?.textContent).toBe('Shot at sunrise');
  });

  it('keeps blank canonical names distinct from rendered fallback titles', () => {
    const audio = buildAudioMediaDom(resolveAudioViewModel({}));
    const video = buildVideoMediaDom(resolveVideoViewModel({}));

    expect(audio.getAttribute('data-media-name')).toBe('');
    expect(audio.querySelector('.audio-block__title')?.textContent).toBe('Untitled audio');
    expect(video.getAttribute('data-media-name')).toBe('');
    expect(video.querySelector('.video-block__title')?.textContent).toBe('Untitled video');
  });
});
