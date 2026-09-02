'use client';

import type { FocusEventHandler, KeyboardEventHandler, PointerEventHandler } from 'react';
import classes from './ResizeHandle.module.css';

export type ResizeHandleDirection = 'left' | 'right';

export interface ResizeHandleProps {
  className?: string;
  direction: ResizeHandleDirection;
  value: number;
  min: number;
  max: number;
  ariaLabel: string;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
}

/**
 * Pure accessible resize control. Layout, persistence, and drag math belong
 * to the feature adapter so this control remains reusable outside editors.
 */
export function ResizeHandle({
  className,
  direction,
  value,
  min,
  max,
  ariaLabel,
  onPointerDown,
  onKeyDown,
  onBlur,
}: ResizeHandleProps) {
  return (
    <button
      type="button"
      className={[classes.handle, 'resizable-block__handle', className].filter(Boolean).join(' ')}
      data-resize-handle
      data-resize-direction={direction}
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      role="slider"
      onPointerDown={onPointerDown}
      onKeyDownCapture={onKeyDown}
      onBlur={onBlur}
    />
  );
}
