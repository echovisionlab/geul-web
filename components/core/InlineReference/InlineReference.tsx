'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { IconVariable } from '@tabler/icons-react';
import { presentationAttributes } from '../presentation-contract';
import type { ClosedVisualProps } from '../visual-contract';
import classes from './InlineReference.module.css';

export interface InlineReferenceProps extends ClosedVisualProps {
  children: string;
  selected?: boolean;
  unset?: boolean;
  label: string;
  description?: string;
  tabIndex?: number;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  onMouseDown?: ButtonHTMLAttributes<HTMLButtonElement>['onMouseDown'];
  onKeyDown?: ButtonHTMLAttributes<HTMLButtonElement>['onKeyDown'];
  'aria-describedby'?: string;
}

/** A baseline-aligned, neutral reference in authored prose. Core owns its interactive presentation. */
export const InlineReference = forwardRef<HTMLButtonElement, InlineReferenceProps>(
  ({ children, label, selected, unset, description, ...props }, ref) => (
    <button
      {...presentationAttributes(props)}
      ref={ref}
      type="button"
      className={classes.reference}
      aria-label={label}
      title={description}
      data-selected={selected || undefined}
      data-unset={unset || undefined}
    >
      <IconVariable aria-hidden size="1em" />
      <bdi className={classes.value}>{children}</bdi>
    </button>
  ),
);
InlineReference.displayName = 'InlineReference';
