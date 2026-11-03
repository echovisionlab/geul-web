import type { ReactNode } from 'react';
import type { ClosedVisualProps } from '../visual-contract';
import { ControlContrastProvider } from '../control-context';
import classes from './VideoControls.module.css';
export interface MediaVideoFrameProps extends ClosedVisualProps {
  children: ReactNode;
  /** Reserve the initial fluid region until mounted media supplies its size. */
  preparing?: boolean;
  processing?: boolean;
  role?: 'group';
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}
export function MediaVideoFrame({
  children,
  preparing = false,
  processing = false,
  role,
  'aria-label': label,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
}: MediaVideoFrameProps) {
  return (
    <div
      role={role ?? (label || labelledBy ? 'group' : undefined)}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={`${classes.frame} video-player-container`}
      data-video-player-preparing={String(preparing)}
      data-video-player-processing={String(processing)}
    >
      {children}
    </div>
  );
}
export function MediaActionSlot({ children }: { children: ReactNode } & ClosedVisualProps) {
  return <ControlContrastProvider contrast="inverse">{children}</ControlContrastProvider>;
}
export function applyVideoFramePresentation(element: HTMLElement) {
  element.classList.add(classes.frame);
}
