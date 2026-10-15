import type { ReactNode } from 'react';
import classes from '../Overlay.module.css';
export function TooltipShortcut({ children }: { children: ReactNode }) {
  return <kbd className={classes.shortcut}>{children}</kbd>;
}
export function TooltipContent({ label, shortcut }: { label: ReactNode; shortcut?: ReactNode }) {
  return (
    <span className={classes.tooltipContent}>
      <span className={classes.tooltipLabel}>{label}</span>
      {shortcut ? <TooltipShortcut>{shortcut}</TooltipShortcut> : null}
    </span>
  );
}
