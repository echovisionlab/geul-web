'use client';

import type { FocusEventHandler, KeyboardEventHandler, PointerEventHandler } from 'react';
import type { ClosedVisualProps } from '../visual-contract';
import classes from './ResizeHandle.module.css';

export type ResizeHandleDirection = 'left' | 'right';

export type ResizeHandlePlacement = 'inline' | 'media-edge';
export type ResizeHandleVisibility = 'always' | 'on-interaction' | 'active';

export interface ResizeHandleProps extends ClosedVisualProps {
  placement?: ResizeHandlePlacement;
  visibility?: ResizeHandleVisibility;
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
 * Core owns placement and visibility feedback. The adapter supplies authored
 * geometry, interaction state and drag math through the closed contract.
 */
export function ResizeHandle({
  placement = 'inline',
  visibility = 'always',
  direction,
  value,
  min,
  max,
  ariaLabel,
  onPointerDown,
  onKeyDown,
  onBlur,
}: ResizeHandleProps) {
  if (!['inline', 'media-edge'].includes(placement) || !['always', 'on-interaction', 'active'].includes(visibility)) {
    throw new RangeError('Resize handles require registered placement and visibility roles.');
  }
  return (
    <button
      type="button"
      className={classes.handle}
      data-geul-resize-placement={placement}
      data-geul-resize-visibility={visibility}
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
