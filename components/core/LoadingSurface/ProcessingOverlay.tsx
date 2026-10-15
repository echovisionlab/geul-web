'use client';
import { forwardRef } from 'react';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import { Progress, type ProgressProps } from '../Progress';
import { LayoutStack } from '../Layout';
import classes from './ProcessingOverlay.module.css';
export interface ProcessingOverlayProps extends PresentationProps {
  /** The same named Progress contract used outside this covering surface. */
  progress?: ProgressProps;
}
export const ProcessingOverlay = forwardRef<HTMLDivElement, ProcessingOverlayProps>(
  ({ children, progress, ...props }, ref) => (
    <div {...presentationAttributes(props)} ref={ref} className={classes.overlay}>
      <div className={classes.content}>
        <LayoutStack gap="xs">
          {progress ? <Progress {...progress} contrast="image" /> : null}
          {children}
        </LayoutStack>
      </div>
    </div>
  ),
);
ProcessingOverlay.displayName = 'ProcessingOverlay';
