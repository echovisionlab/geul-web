// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { readAudioMediaHydration, readVideoMediaHydration } from './hydration';

describe('media hydration readers', () => {
  it('reads audio data from the new contract attrs', () => {
    document.body.innerHTML = `
      <div
        class="audio-block"
        data-media-kind="audio"
        data-file-id="audio-1"
        data-playback-url="https://cdn.example.com/master.m3u8"
        data-playback-source="hls"
        data-original-url="https://cdn.example.com/original.wav"
        data-waveform-url="https://cdn.example.com/waveform.json"
        data-spectrogram-url="https://cdn.example.com/spectrogram.png"
        data-allow-original-download="true"
      >
        <audio data-file-id="audio-1"></audio>
      </div>
    `;

    const root = document.querySelector('.audio-block') as HTMLElement;
    const audio = root.querySelector('audio') as HTMLAudioElement;
    const parsed = readAudioMediaHydration(root, audio);

    expect(parsed.fileId).toBe('audio-1');
    expect(parsed.playbackUrl).toBe('https://cdn.example.com/master.m3u8');
    expect(parsed.originalUrl).toBe('https://cdn.example.com/original.wav');
    expect(parsed.waveformUrl).toBe('https://cdn.example.com/waveform.json');
    expect(parsed.spectrogramUrl).toBe('https://cdn.example.com/spectrogram.png');
  });

  it('uses the audio element src when playback attr is absent', () => {
    document.body.innerHTML = `
      <div
        class="audio-block"
        data-file-id="audio-2"
        data-original-url="https://cdn.example.com/original.wav"
      >
        <audio data-file-id="audio-2" src="https://cdn.example.com/master.m3u8"></audio>
      </div>
    `;

    const root = document.querySelector('.audio-block') as HTMLElement;
    const audio = root.querySelector('audio') as HTMLAudioElement;
    const parsed = readAudioMediaHydration(root, audio);

    expect(parsed.fileId).toBe('audio-2');
    expect(parsed.playbackUrl).toBe('https://cdn.example.com/master.m3u8');
    expect(parsed.waveformUrl).toBe('');
  });

  it('reads video data from the shared contract attrs', () => {
    document.body.innerHTML = `
      <div class="video-block" data-media-kind="video" data-file-id="video-1" data-original-url="https://cdn.example.com/original.mp4" data-hls-src="https://cdn.example.com/master.m3u8" data-poster-url="https://cdn.example.com/thumb.webp">
        <video data-file-id="video-1"></video>
      </div>
    `;

    const root = document.querySelector('.video-block') as HTMLElement;
    const video = root.querySelector('video') as HTMLVideoElement;
    const parsed = readVideoMediaHydration(root, video);

    expect(parsed.fileId).toBe('video-1');
    expect(parsed.originalUrl).toBe('https://cdn.example.com/original.mp4');
    expect(parsed.hlsUrl).toBe('https://cdn.example.com/master.m3u8');
    expect(parsed.posterUrl).toBe('https://cdn.example.com/thumb.webp');
  });
});
