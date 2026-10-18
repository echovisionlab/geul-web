// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaWaveformSeek, type MediaWaveformSeekProps } from './MediaWaveformSeek';
import { applyAudioSeekPresentation } from './media-seek';
import { applyAudioMediaPresentation } from './native-audio';
import classes from './MediaControls.module.css';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;
afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  root = undefined;
  container?.remove();
  container = undefined;
});

function renderSeek(props: Partial<MediaWaveformSeekProps> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  container = host;
  root = createRoot(host);
  const onSeek = vi.fn();
  const onTogglePlayback = vi.fn();
  const render = (next: Partial<MediaWaveformSeekProps> = {}) =>
    act(() =>
      root?.render(
        <MediaWaveformSeek
          label="Seek playback"
          currentTime={30}
          duration={100}
          waveRef={createRef<HTMLDivElement>()}
          waveReady
          onSeek={onSeek}
          onTogglePlayback={onTogglePlayback}
          {...props}
          {...next}
        />,
      ),
    );
  render();
  const input = host.querySelector<HTMLInputElement>('input[type="range"]')!;
  return { host, input, onSeek, onTogglePlayback, render };
}

const key = (input: HTMLElement, value: string) =>
  act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })));

describe('Core MediaWaveformSeek', () => {
  it('exposes one named native range with time value text before hydration', () => {
    const html = renderToStaticMarkup(
      <MediaWaveformSeek
        label="Seek playback"
        currentTime={65}
        duration={100}
        waveRef={createRef<HTMLDivElement>()}
        waveReady={false}
        loading
        onSeek={() => {}}
      />,
    );
    expect(html).toContain('type="range"');
    expect(html).toContain('aria-label="Seek playback"');
    expect(html).toContain('aria-valuetext="1:05 / 1:40"');
    expect(html).not.toContain('role="slider"');
    expect(html).not.toContain('tabindex');
    expect(html).toContain('data-audio-player-wave-loading="true"');
  });

  it('moves by five seconds with arrows, ten with Page keys and to the bounds with Home/End', () => {
    const { input, onSeek } = renderSeek();
    expect(input.value).toBe('30');
    expect(input.max).toBe('100');
    key(input, 'ArrowRight');
    expect(onSeek).toHaveBeenLastCalledWith(35);
    key(input, 'ArrowDown');
    expect(onSeek).toHaveBeenLastCalledWith(25);
    key(input, 'PageUp');
    expect(onSeek).toHaveBeenLastCalledWith(40);
    key(input, 'PageDown');
    expect(onSeek).toHaveBeenLastCalledWith(20);
    key(input, 'Home');
    expect(onSeek).toHaveBeenLastCalledWith(0);
    key(input, 'End');
    expect(onSeek).toHaveBeenLastCalledWith(100);
  });

  it('toggles playback with Enter/Space and seeks from native value changes and pointer position', () => {
    const { host, input, onSeek, onTogglePlayback } = renderSeek();
    key(input, 'a');
    expect(onSeek).not.toHaveBeenCalled();
    expect(onTogglePlayback).not.toHaveBeenCalled();
    key(input, 'Enter');
    key(input, ' ');
    expect(onTogglePlayback).toHaveBeenCalledTimes(2);
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, '70');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onSeek).toHaveBeenLastCalledWith(70);
    const frame = input.parentElement!;
    frame.getBoundingClientRect = () => ({ left: 0, width: 200 }) as DOMRect;
    act(() => frame.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 50 })));
    expect(onSeek).toHaveBeenLastCalledWith(25);
    expect(host.querySelector('[data-audio-player-wave]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('updates value text and stays inert while unavailable', () => {
    const { input, onSeek, render } = renderSeek();
    render({ currentTime: 42 });
    expect(input.getAttribute('aria-valuetext')).toBe('0:42 / 1:40');
    render({ disabled: true, 'aria-describedby': 'status' });
    expect(input.disabled).toBe(true);
    expect(input.getAttribute('aria-describedby')).toBe('status');
    key(input, 'ArrowRight');
    expect(onSeek).not.toHaveBeenCalled();
    render({ disabled: false, duration: 0 });
    expect(input.disabled).toBe(true);
    expect(input.getAttribute('aria-valuetext')).toBe('0:30 / --:--');
  });
});

describe('Core audio seek DOM adapter', () => {
  it('replaces persisted slider semantics with a single reusable native range', () => {
    const frame = document.createElement('div');
    frame.className = 'audio-player__wave-frame';
    frame.setAttribute('role', 'slider');
    frame.setAttribute('tabindex', '0');
    frame.setAttribute('aria-valuenow', '3');
    const first = applyAudioSeekPresentation(frame, { label: 'Seek', currentTime: 3, duration: 60, disabled: false });
    const second = applyAudioSeekPresentation(frame, {
      label: 'Seek audio',
      currentTime: 12,
      duration: 60,
      disabled: true,
      describedBy: 'failed',
    });
    expect(second).toBe(first);
    expect(frame.querySelectorAll('input')).toHaveLength(1);
    expect(frame.hasAttribute('role')).toBe(false);
    expect(frame.hasAttribute('tabindex')).toBe(false);
    expect(frame.hasAttribute('aria-valuenow')).toBe(false);
    expect(second.type).toBe('range');
    expect(second.value).toBe('12');
    expect(second.disabled).toBe(true);
    expect(second.getAttribute('aria-label')).toBe('Seek audio');
    expect(second.getAttribute('aria-valuetext')).toBe('0:12 / 1:00');
    expect(second.getAttribute('aria-describedby')).toBe('failed');
    expect(second.classList.contains(classes.seek)).toBe(true);
  });

  it('projects exported structure onto Core-owned classes', () => {
    const player = document.createElement('div');
    player.innerHTML =
      '<div class="audio-player__content"><div class="audio-player__wave-frame"><div data-audio-player-wave="true"></div><div data-audio-player-wave-loading="true"></div></div></div>' +
      '<button data-audio-player-toggle="true"><span class="audio-player__icon audio-player__icon--play"></span></button>';
    applyAudioMediaPresentation(player);
    expect(player.querySelector('.audio-player__content')?.classList.contains(classes.content)).toBe(true);
    expect(player.querySelector('.audio-player__wave-frame')?.classList.contains(classes.waveFrame)).toBe(true);
    expect(player.querySelector('[data-audio-player-wave]')?.classList.contains(classes.wave)).toBe(true);
    expect(player.querySelector('[data-audio-player-wave-loading]')?.classList.contains(classes.waveLoading)).toBe(
      true,
    );
    expect(player.querySelector('button')?.classList.contains(classes.toggle)).toBe(true);
    expect(player.querySelector('.audio-player__icon--play')?.classList.contains(classes.iconPlay)).toBe(true);
  });

  // Stylesheet ownership: Core media CSS styles only its own classes. Move to a design-system policy rule
  // (scripts/design-system/framework-policy.mjs) once that policy records the existing Core :global adapters.
  it('keeps media CSS free of foreign class selectors', () => {
    const css = readFileSync(resolve(process.cwd(), 'components/core/MediaControls/MediaControls.module.css'), 'utf8');
    expect(css).not.toContain(':global(');
  });
});
