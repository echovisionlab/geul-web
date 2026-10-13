import { applyNativeRange } from '../Input/native-range';
import classes from './MediaControls.module.css';
import { formatMediaClock } from './media-clock';

/** Arrow keys move five seconds and Page keys ten seconds, matching the previous media slider contract. */
const seekKeySteps: Readonly<Record<string, number>> = {
  ArrowLeft: -5,
  ArrowDown: -5,
  ArrowRight: 5,
  ArrowUp: 5,
  PageDown: -10,
  PageUp: 10,
};

export type MediaSeekKeyResult = { kind: 'seek'; time: number } | { kind: 'toggle' } | null;

/** Resolves the shared media seek keyboard contract; callers own the actual media command. */
export function resolveMediaSeekKey(key: string, currentTime: number, duration: number): MediaSeekKeyResult {
  if (key === 'Home') {
    return { kind: 'seek', time: 0 };
  }
  if (key === 'End') {
    return { kind: 'seek', time: duration };
  }
  if (key in seekKeySteps) {
    return { kind: 'seek', time: currentTime + seekKeySteps[key] };
  }
  if (key === 'Enter' || key === ' ') {
    return { kind: 'toggle' };
  }
  return null;
}

/** Maps a pointer position inside the waveform frame to media time. */
export function resolveMediaSeekPointer(frame: HTMLElement, clientX: number, duration: number): number | null {
  if (!(duration > 0)) {
    return null;
  }
  const rect = frame.getBoundingClientRect();
  if (!rect.width) {
    return null;
  }
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration;
}

export function formatMediaSeekValueText(currentTime: number, duration: number) {
  return `${formatMediaClock(currentTime)} / ${duration > 0 ? formatMediaClock(duration) : '--:--'}`;
}

export interface MediaSeekPresentation {
  label: string;
  currentTime: number;
  duration: number;
  disabled: boolean;
  describedBy?: string;
}

/** The seek range stays a native slider; the visible waveform remains the pointer surface. */
export function applyMediaSeekRange(
  input: HTMLInputElement,
  { label, currentTime, duration, disabled, describedBy }: MediaSeekPresentation,
) {
  const max = duration > 0 ? duration : 1;
  applyNativeRange(input, {
    min: 0,
    max,
    step: 1,
    value: Math.max(0, Math.min(max, currentTime)),
    label,
    valueText: formatMediaSeekValueText(currentTime, duration),
    disabled: disabled || !(duration > 0),
  });
  input.classList.add(classes.seek);
  input.setAttribute('data-audio-player-seek', 'true');
  if (describedBy) {
    input.setAttribute('aria-describedby', describedBy);
  } else {
    input.removeAttribute('aria-describedby');
  }
  return input;
}

const legacySliderAttributes = [
  'role',
  'tabindex',
  'aria-label',
  'aria-orientation',
  'aria-valuemin',
  'aria-valuemax',
  'aria-valuenow',
  'aria-valuetext',
  'aria-disabled',
  'aria-describedby',
];

/**
 * Converts an exported or persisted waveform/timeline frame into the Core seek structure.
 * Legacy `role="slider"` semantics move from the frame to one native range; repeated calls reuse it.
 */
export function applyAudioSeekPresentation(frame: HTMLElement, presentation: MediaSeekPresentation) {
  legacySliderAttributes.forEach((name) => frame.removeAttribute(name));
  let input = frame.querySelector<HTMLInputElement>(':scope > input[data-audio-player-seek]');
  if (!input) {
    input = frame.ownerDocument.createElement('input');
    frame.appendChild(input);
  }
  return applyMediaSeekRange(input, presentation);
}
