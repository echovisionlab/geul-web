'use client';
import type { ReactNode } from 'react';
import classes from './ReorderGutter.module.css';
import type { ClosedVisualProps } from '../visual-contract';
/** Editor adapters share an outside fine-pointer gutter and an in-flow coarse-pointer track. */
export interface ReorderGutterProps extends ClosedVisualProps {
  children: ReactNode;
  handle?: ReactNode;
  visibility?: 'on-interaction' | 'active';
}
export function ReorderGutter({ children, handle, visibility = 'on-interaction' }: ReorderGutterProps) {
  return (
    <div className={classes.frame}>
      {handle ? (
        <div className={classes.root} data-geul-reorder-gutter={visibility} contentEditable={false}>
          {handle}
        </div>
      ) : null}
      <div className={classes.body}>{children}</div>
    </div>
  );
}
