// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { resolveHydratedAudioSrc, resolveHydratedVideoSources } from './media-hydration';

describe('media hydration helpers', () => {
  it('prefers explicit audio playback contract before cdn fallback', () => {
    document.body.innerHTML = `
      <div class="audio-block" data-media-kind="audio" data-file-id="audio-1" data-playback-url="https://cdn.example.com/master.m3u8">
        <audio data-file-id="audio-1"></audio>
      </div>
    `;

    const block = document.querySelector('.audio-block') as HTMLElement;
    const audio = block.querySelector('audio') as HTMLAudioElement;
    const src = resolveHydratedAudioSrc({
      block,
      audio,
    });

    expect(src).toBe('https://cdn.example.com/master.m3u8');
  });

  it('returns empty audio src when the shared contract is missing', () => {
    document.body.innerHTML = `
      <div class="audio-block" data-file-id="audio-2" data-entity-type="post" data-entity-id="post-2">
        <audio data-file-id="audio-2"></audio>
      </div>
    `;

    const block = document.querySelector('.audio-block') as HTMLElement;
    const audio = block.querySelector('audio') as HTMLAudioElement;
    const src = resolveHydratedAudioSrc({
      block,
      audio,
    });

    expect(src).toBe('');
  });

  it('prefers explicit video hls src and poster', () => {
    document.body.innerHTML = `
      <div class="video-block" data-media-kind="video" data-file-id="video-1" data-hls-src="https://cdn.example.com/master.m3u8" data-poster-url="https://cdn.example.com/thumb.webp">
        <video data-file-id="video-1"></video>
      </div>
    `;

    const block = document.querySelector('.video-block') as HTMLElement;
    const video = block.querySelector('video') as HTMLVideoElement;
    const result = resolveHydratedVideoSources({
      block,
      video,
    });

    expect(result.hlsSrc).toBe('https://cdn.example.com/master.m3u8');
    expect(result.originalUrl).toBe('');
    expect(result.posterUrl).toBe('https://cdn.example.com/thumb.webp');
  });

  it('does not treat direct mp4 video src as hls', () => {
    document.body.innerHTML = `
      <div class="video-block" data-media-kind="video" data-file-id="video-2" data-original-url="https://cdn.example.com/original.mp4">
        <video data-file-id="video-2" src="https://cdn.example.com/original.mp4"></video>
      </div>
    `;

    const block = document.querySelector('.video-block') as HTMLElement;
    const video = block.querySelector('video') as HTMLVideoElement;
    const result = resolveHydratedVideoSources({
      block,
      video,
    });

    expect(result.hlsSrc).toBe('');
    expect(result.originalUrl).toBe('https://cdn.example.com/original.mp4');
    expect(video.getAttribute('src')).toBe('https://cdn.example.com/original.mp4');
  });
});
