import control from '../Control.module.css';
import surface from '../Section/Surface.module.css';
import display from '../Display/Display.module.css';
import { applyTextPresentation } from '../Typography/dom-text';
import { applyNativeRange } from '../Input/native-range';
import classes from './MediaControls.module.css';

/** Finite adapter for the exported audio DOM protocol; domain event listeners remain with hydration. */
export function applyAudioMediaPresentation(player: HTMLElement) {
  player.classList.add(classes.audio, surface.surface);
  player.dataset.border = 'all';
  player.dataset.appearance = 'surface';
  // Exported DOM keeps its protocol hooks; only Core module classes carry presentation.
  for (const [selector, name] of Object.entries({
    '.audio-player__content': 'content',
    '.audio-player__visual': 'visual',
    '.audio-player__wave-frame': 'waveFrame',
    '[data-audio-player-wave]': 'wave',
    '[data-audio-player-wave-loading]': 'waveLoading',
    '.audio-player__track': 'track',
    '[data-audio-player-track-fill], .audio-player__track-fill': 'trackFill',
    '[data-audio-player-track-thumb], .audio-player__track-thumb': 'trackThumb',
    '.audio-player__footer': 'transport',
    '.audio-player__controls': 'controls',
    '.audio-player__meta': 'clock',
    '.audio-player__toolbar': 'actions',
    '[data-audio-player-toggle]': 'toggle',
    '[data-audio-player-mute]': 'mute',
    '.audio-player__icon': 'icon',
    '.audio-player__icon--play': 'iconPlay',
    '.audio-player__icon--pause': 'iconPause',
    '.audio-player__icon--volume': 'iconVolume',
    '.audio-player__icon--mute': 'iconMute',
  })) {
    player.querySelectorAll(selector).forEach((element) => element.classList.add(classes[name]));
  }
  player
    .querySelectorAll<HTMLElement>('[data-audio-player-toggle], [data-audio-player-mute], [data-audio-player-download]')
    .forEach((element) => {
      element.classList.add(control.root);
      element.dataset.controlKind = element.tagName === 'A' ? 'button' : 'icon';
      element.dataset.controlSize = 'chrome';
      element.dataset.emphasis = 'low';
      element.dataset.tone = 'neutral';
    });
  const range = player.querySelector<HTMLInputElement>('[data-audio-player-volume]');
  if (range) {
    applyNativeRange(range, {
      min: 0,
      max: 1,
      step: 0.01,
      value: Number(range.value),
      label: range.getAttribute('aria-label') || '',
      disabled: range.disabled,
    });
    range.classList.add(classes.volume);
  }
  player
    .querySelectorAll<HTMLElement>(
      '[data-audio-player-current-time], [data-audio-player-duration], .audio-player__time-separator',
    )
    .forEach((element) => {
      applyTextPresentation(element, {
        size: 'xs',
        weight: element.hasAttribute('data-audio-player-current-time') ? 'strong' : 'regular',
        tone: element.hasAttribute('data-audio-player-current-time') ? 'primary' : 'muted',
      });
    });
  player.querySelectorAll<HTMLElement>('.audio-player__wave-loading-spinner').forEach((element) => {
    element.classList.add(display.spinner);
    element.dataset.size = 'xs';
  });
}
