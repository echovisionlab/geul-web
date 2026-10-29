'use client';

import { forwardRef, type ForwardedRef, type ReactNode } from 'react';
import { Button, type ButtonActionProps } from './Button';

export interface SaveButtonProps extends Omit<ButtonActionProps, 'tone' | 'emphasis' | 'children'> {
  /** Localized label, usually common.actions.save. */
  children: ReactNode;
}

/**
 * The commit action of a form or settings panel, filled with the configured site color.
 * Submits by default; pass `type="button"` with `onClick` for panels without a form.
 */
function SaveButtonInner({ type = 'submit', ...props }: SaveButtonProps, ref: ForwardedRef<HTMLButtonElement>) {
  return <Button ref={ref} tone="brand" emphasis="strong" type={type} {...props} />;
}

export const SaveButton = forwardRef(SaveButtonInner);
