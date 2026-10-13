'use client';

import { forwardRef } from 'react';
import { controlNativeProps, type ControlNativeProps } from '../control-props';
import classes from './BlockSelectionTarget.module.css';

export interface BlockSelectionTargetProps extends Omit<
  ControlNativeProps,
  'aria-label' | 'aria-labelledby' | 'role' | 'draggable'
> {
  /** Names the selectable block, for example its kind or title. */
  label: string;
  /**
   * `pass-through` leaves pointer input to the block's own content and serves keyboard selection.
   * `capture` covers embedded content (such as a third-party frame) so a click selects the block.
   */
  pointer?: 'pass-through' | 'capture';
}

/**
 * Transparent selection target that covers an independent editor block. Its positioned parent
 * owns block geometry and the persistent selected boundary; Core owns the target and its focus ring.
 */
export const BlockSelectionTarget = forwardRef<HTMLButtonElement, BlockSelectionTargetProps>(
  ({ label, pointer = 'pass-through', ...props }, ref) => {
    if (!label.trim()) {
      throw new TypeError('Core BlockSelectionTarget requires a nonempty label');
    }
    if (pointer !== 'pass-through' && pointer !== 'capture') {
      throw new RangeError('Invalid block selection pointer mode');
    }
    return (
      <button
        {...controlNativeProps(props)}
        ref={ref}
        type="button"
        className={classes.target}
        aria-label={label}
        contentEditable={false}
        draggable={false}
        data-geul-block-selection-pointer={pointer}
      />
    );
  },
);
BlockSelectionTarget.displayName = 'BlockSelectionTarget';
