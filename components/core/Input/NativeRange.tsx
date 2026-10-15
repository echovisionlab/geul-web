'use client';
import { useLayoutEffect, useRef } from 'react';
import { applyNativeRange, type NativeRangePresentation } from './native-range';
import classes from './NativeRange.module.css';
export interface NativeRangeProps extends NativeRangePresentation {
  onChange: (value: number) => void;
  purpose?: 'generic' | 'audio-volume';
}
export function NativeRange({
  onChange,
  purpose = 'generic',
  min,
  max,
  step,
  value,
  label,
  valueText,
  disabled,
}: NativeRangeProps) {
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (ref.current) {
      applyNativeRange(ref.current, { min, max, step, value, label, valueText, disabled });
    }
  }, [min, max, step, value, label, valueText, disabled]);
  return (
    <input
      ref={ref}
      className={classes.range}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={label}
      aria-valuetext={valueText}
      data-audio-player-volume={purpose === 'audio-volume' ? 'true' : undefined}
      onChange={(event) => {
        if (!disabled) {
          onChange(Number(event.currentTarget.value));
        }
      }}
    />
  );
}
