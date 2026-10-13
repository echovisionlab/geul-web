'use client';

import { forwardRef } from 'react';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import classes from './Input.module.css';

export interface InputFrameProps extends PresentationProps {
  /** Error state of the hosted editor; its message remains in the surrounding Field. */
  invalid?: boolean;
  disabled?: boolean;
}

/**
 * Core text-entry chrome for an editable surface that is not a native input, such as a small
 * rich-text editor. It uses the TextInput/Textarea underline, hover, focus, error and disabled
 * treatment; the hosted editor owns its content geometry and its own name and description.
 */
export const InputFrame = forwardRef<HTMLDivElement, InputFrameProps>(
  ({ invalid = false, disabled = false, children, ...props }, ref) => (
    <div
      {...presentationAttributes(props)}
      ref={ref}
      className={classes.frameRoot}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
    >
      <div className={classes.wrapper} data-geul-input-frame="">
        {children}
      </div>
    </div>
  ),
);
InputFrame.displayName = 'InputFrame';
