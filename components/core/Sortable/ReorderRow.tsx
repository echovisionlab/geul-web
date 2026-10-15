'use client';

import { forwardRef, type ReactNode } from 'react';
import { ToolbarDensityProvider } from '../control-context';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import classes from './ReorderRow.module.css';

/** One compact leading track, a flexible body, and independent trailing actions. */
export interface ReorderRowProps extends PresentationProps {
  'data-geul-reorder-row'?: never;
  'data-geul-reorder-indent'?: never;
  handle?: ReactNode;
  actions?: ReactNode;
  indent?: 'none' | 'parent-label';
}
export const ReorderRow = forwardRef<HTMLDivElement, ReorderRowProps>(
  ({ handle, actions, children, indent = 'none', ...props }, ref) => (
    <ToolbarDensityProvider density="compact">
      <div
        {...presentationAttributes(props)}
        ref={ref}
        className={classes.root}
        data-geul-reorder-row
        data-geul-reorder-indent={indent}
      >
        {handle ? <div className={classes.handle}>{handle}</div> : null}
        <div className={classes.body}>{children}</div>
        {actions ? <div className={classes.actions}>{actions}</div> : null}
      </div>
    </ToolbarDensityProvider>
  ),
);
ReorderRow.displayName = 'ReorderRow';
