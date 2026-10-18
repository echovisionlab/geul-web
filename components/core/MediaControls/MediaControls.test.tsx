// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { semanticThemes } from '../design-tokens';
import { applyNativeRange, updateNativeRangeValue } from '../Input/native-range';
import { MediaTransport, MediaAudioFrame } from './MediaTransport';
import { MediaVideoFrame } from './MediaVideoFrame';
import { applyVideoMediaPresentation } from './native-video';
import videoClasses from './VideoControls.module.css';

// Compare the real popup cascade, without parsing unrelated fonts/fullscreen/technical selectors in jsdom.
function popupRules(file: string) {
  return postcss
    .parse(readFileSync(resolve(process.cwd(), file), 'utf8'))
    .nodes.filter((node) => node.type === 'rule' && node.selector.includes('vjs-menu'))
    .map((node) => node.toString())
    .join('\n');
}
const ownerPopupCss = popupRules('components/core/MediaControls/VideoControls.module.css');
const sdkPopupCss = popupRules('node_modules/video.js/dist/video-js.css');

let reactRoot: Root | undefined;
const disposers: Array<() => void> = [];
afterEach(() => {
  if (reactRoot) {
    act(() => reactRoot?.unmount());
  }
  reactRoot = undefined;
  disposers.splice(0).forEach((dispose) => dispose());
  document.body.replaceChildren();
  document.head.querySelector('[data-media-proof]')?.remove();
});
function makeSdkDom() {
  const root = document.createElement('div');
  root.className = 'video-js';
  root.innerHTML =
    '<button class="vjs-button vjs-play-control" aria-label="Play"></button><div class="vjs-menu-button-popup"><div class="vjs-menu"><ul class="vjs-menu-content"><li class="vjs-menu-item vjs-selected" role="menuitemradio" aria-checked="true" tabindex="0">1x</li></ul></div></div>';
  document.body.appendChild(root);
  disposers.push(applyVideoMediaPresentation(root, { kind: 'video-js' }));
  return root;
}
function luminance(rgb: string) {
  const channels = rgb
    .match(/[\d.]+/g)!
    .slice(0, 3)
    .map((value) => {
      const linear = Number(value) / 255;
      return linear <= 0.04045 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
describe('Core media contracts', () => {
  it('retains semantic media group names and description relationships without exposing presentation overrides', () => {
    const host = document.createElement('div');
    document.body.append(host);
    reactRoot = createRoot(host);
    act(() =>
      reactRoot!.render(
        <>
          <span id="media-description">Original recording</span>
          <MediaAudioFrame playing={false} ready aria-label="recording.wav" aria-describedby="media-description">
            Audio
          </MediaAudioFrame>
          <MediaVideoFrame role="group" aria-label="interview.mp4">
            Video
          </MediaVideoFrame>
        </>,
      ),
    );
    const groups = host.querySelectorAll('[role="group"]');
    expect([...groups].map((item) => item.getAttribute('aria-label'))).toEqual(['recording.wav', 'interview.mp4']);
    expect(groups[0].getAttribute('aria-describedby')).toBe('media-description');
  });
  it('keeps live transport callbacks and accessible names on actual shared controls', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    reactRoot = createRoot(host);
    const play = vi.fn(),
      mute = vi.fn(),
      volume = vi.fn();
    act(() =>
      reactRoot!.render(
        <MediaTransport
          labels={{ play: 'Play', pause: 'Pause', mute: 'Mute', unmute: 'Unmute', volume: 'Volume' }}
          playing={false}
          muted={false}
          volume={0.5}
          currentTime={42}
          duration={120}
          onPlay={play}
          onMute={mute}
          onVolumeChange={volume}
        />,
      ),
    );
    const buttons = host.querySelectorAll('button');
    act(() => buttons[0].click());
    act(() => buttons[1].click());
    expect(play).toHaveBeenCalledOnce();
    expect(mute).toHaveBeenCalledOnce();
    expect(buttons[0].dataset.controlKind).toBe('icon');
    expect(host.querySelector('[data-audio-player-current-time]')?.textContent).toBe('0:42');
    expect(host.querySelector('[data-audio-player-duration]')?.textContent).toBe('2:00');
    const input = host.querySelector<HTMLInputElement>('input[type=range]')!;
    expect(input.value).toBe('0.5');
    expect(input.getAttribute('aria-label')).toBe('Volume');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '0.25');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(volume).toHaveBeenCalledWith(0.25);
  });
  it('projects native range values and rejects visual escapes hidden in JavaScript arguments', () => {
    const input = document.createElement('input');
    applyNativeRange(input, {
      min: 0,
      max: 1,
      step: 0.01,
      value: 2,
      label: 'Volume',
      disabled: true,
      ...({ style: { color: 'red' }, className: 'foreign', vars: { '--private': 'red' } } as object),
    });
    expect(input.type).toBe('range');
    expect(input.value).toBe('1');
    expect(input.disabled).toBe(true);
    expect(input.style.length).toBe(0);
    expect(input.classList.contains('foreign')).toBe(false);
    updateNativeRangeValue(input, Number.NaN);
    expect(input.value).toBe('0');
    expect(() => applyNativeRange(input, { min: 1, max: 1, value: 1, label: 'Invalid' })).toThrow(RangeError);
  });
  for (const mode of ['light', 'dark'] as const) {
    it(`renders a readable selected SDK popup row on the ${mode} shared surface`, () => {
      const root = makeSdkDom();
      // Resolve the real owner's selectors and canonical color roles, because jsdom cannot resolve CSS variables.
      const css = ownerPopupCss
        .replace(/:global\(([^)]+)\)/g, '$1')
        .replace(/\.video(?![\w-])/g, `.${videoClasses.video}`)
        .replace(
          /var\(--geul-([\w-]+)\)/g,
          (raw, role: string) => (semanticThemes[mode] as Record<string, string>)[role] ?? raw,
        );
      const style = document.createElement('style');
      style.dataset.mediaProof = 'true';
      // The SDK sheet deliberately follows the Core sheet to catch specificity regressions.
      style.textContent = `${css}\n${sdkPopupCss}`;
      document.head.appendChild(style);
      const item = getComputedStyle(root.querySelector('.vjs-menu-item')!);
      const menu = getComputedStyle(root.querySelector('.vjs-menu-content')!);
      expect(menu.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      const text = luminance(item.color),
        background = luminance(item.backgroundColor);
      expect((Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
