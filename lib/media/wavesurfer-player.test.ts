// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountWaveSurferPlayer } from './wavesurfer-player';

const createSpy = vi.fn(() => ({
  on: vi.fn(() => vi.fn()),
  getDuration: vi.fn(() => 120),
  setTime: vi.fn(),
  setOptions: setOptionsSpy,
  destroy: destroySpy,
}));
const setOptionsSpy = vi.fn();
const destroySpy = vi.fn();

vi.mock('wavesurfer.js', () => ({
  default: {
    create: createSpy,
  },
}));

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-mantine-color-scheme');
  createSpy.mockClear();
  setOptionsSpy.mockClear();
  destroySpy.mockClear();
});

describe('mountWaveSurferPlayer', () => {
  it('re-applies colors when the host style changes after mount', async () => {
    const player = document.createElement('div');
    player.setAttribute('data-audio-player', 'true');
    player.style.setProperty('--audio-wave-color', 'rgb(10 20 30)');
    player.style.setProperty('--audio-progress-color', 'rgb(40 50 60)');
    player.style.setProperty('--audio-cursor-color', 'rgb(70 80 90)');

    const container = document.createElement('div');
    const audio = document.createElement('audio');
    player.appendChild(container);
    document.body.appendChild(player);

    const mounted = await mountWaveSurferPlayer({
      audio,
      container,
      src: 'https://cdn.example.com/audio.mp3',
      waveform: [0.1, 0.4, 0.8],
      duration: 120,
    });

    expect(mounted).not.toBeNull();

    player.style.setProperty('--audio-wave-color', 'rgb(100 110 120)');
    player.style.setProperty('--audio-progress-color', 'rgb(130 140 150)');
    player.style.setProperty('--audio-cursor-color', 'rgb(160 170 180)');

    await Promise.resolve();

    expect(setOptionsSpy).toHaveBeenCalledWith({
      waveColor: 'rgb(100 110 120)',
      progressColor: 'rgb(130 140 150)',
      cursorColor: 'rgb(160 170 180)',
    });

    mounted?.destroy();
    expect(destroySpy).toHaveBeenCalled();
  });

  it('creates a waveform player from the audio url even without precomputed peaks', async () => {
    const container = document.createElement('div');
    const audio = document.createElement('audio');
    document.body.appendChild(container);

    const mounted = await mountWaveSurferPlayer({
      audio,
      container,
      src: 'https://cdn.example.com/audio.mp3',
    });

    expect(mounted).not.toBeNull();
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://cdn.example.com/audio.mp3',
        media: audio,
      }),
    );
    const lastCall = createSpy.mock.calls.at(-1) as [Record<string, unknown>] | undefined;
    expect(lastCall?.[0]).not.toHaveProperty('peaks');
  });
});
