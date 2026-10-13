'use client';
import { useLayoutEffect, useRef, type Ref } from 'react';
import type { ClosedVisualProps } from '../visual-contract';
import { Spinner } from '../Display';
import {
  formatMediaSeekValueText,
  resolveMediaSeekKey,
  resolveMediaSeekPointer,
  applyMediaSeekRange,
} from './media-seek';
import classes from './MediaControls.module.css';

export interface MediaWaveformSeekProps extends ClosedVisualProps {
  /** Accessible name of the native seek range. */
  label: string;
  currentTime: number;
  duration: number;
  disabled?: boolean;
  /** Host element for the waveform renderer; Core owns its geometry and readiness presentation. */
  waveRef: Ref<HTMLDivElement>;
  waveReady: boolean;
  /** Shows the centered loading indicator until `waveReady` becomes true. */
  loading?: boolean;
  'aria-describedby'?: string;
  onSeek: (time: number) => void;
  /** Enter/Space on the focused seek range. */
  onTogglePlayback?: () => void;
}

/**
 * Waveform seek surface. Keyboard and assistive technology use one native range
 * (arrows ±5 s, Page ±10 s, Home/End); the visible waveform keeps pointer seeking.
 */
export function MediaWaveformSeek({
  label,
  currentTime,
  duration,
  disabled = false,
  waveRef,
  waveReady,
  loading = false,
  'aria-describedby': describedBy,
  onSeek,
  onTogglePlayback,
}: MediaWaveformSeekProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const unavailable = disabled || !(duration > 0);
  const max = duration > 0 ? duration : 1;
  useLayoutEffect(() => {
    if (inputRef.current) {
      applyMediaSeekRange(inputRef.current, { label, currentTime, duration, disabled, describedBy });
    }
  }, [label, currentTime, duration, disabled, describedBy]);
  return (
    <div className={classes.visual} data-audio-player-view-panel="waveform">
      {/* Pointer seeking is a shortcut for the contained native range, which provides the keyboard equivalent. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={classes.waveFrame}
        onClick={(event) => {
          if (unavailable) {
            return;
          }
          const time = resolveMediaSeekPointer(event.currentTarget, event.clientX, duration);
          if (time !== null) {
            onSeek(time);
          }
        }}
      >
        <div
          ref={waveRef}
          className={classes.wave}
          aria-hidden="true"
          data-audio-player-wave="true"
          data-audio-player-wave-ready={String(waveReady)}
        />
        {loading ? (
          <div
            className={classes.waveLoading}
            data-audio-player-wave-loading="true"
            aria-hidden={waveReady ? 'true' : 'false'}
          >
            <Spinner size="xs" />
          </div>
        ) : null}
        <input
          ref={inputRef}
          className={classes.seek}
          type="range"
          min={0}
          max={max}
          step={1}
          value={Math.max(0, Math.min(max, currentTime))}
          disabled={unavailable}
          aria-label={label}
          aria-valuetext={formatMediaSeekValueText(currentTime, duration)}
          aria-describedby={describedBy}
          data-audio-player-seek="true"
          onChange={(event) => {
            if (!unavailable) {
              onSeek(Number(event.currentTarget.value));
            }
          }}
          onKeyDown={(event) => {
            if (unavailable) {
              return;
            }
            const result = resolveMediaSeekKey(event.key, currentTime, duration);
            if (!result || (result.kind === 'toggle' && !onTogglePlayback)) {
              return;
            }
            event.preventDefault();
            if (result.kind === 'seek') {
              onSeek(result.time);
            } else {
              onTogglePlayback?.();
            }
          }}
        />
      </div>
    </div>
  );
}
