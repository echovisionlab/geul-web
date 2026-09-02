import classes from './RouteProgressBar.module.css';

export type RouteProgressBarPhase = 'idle' | 'waiting' | 'loading' | 'completing';

export interface RouteProgressBarProps {
  'aria-label': string;
  phase: RouteProgressBarPhase;
}

export function RouteProgressBar({ 'aria-label': ariaLabel, phase }: RouteProgressBarProps) {
  const hidden = phase === 'idle' || phase === 'waiting';

  return (
    <div className={classes.root} data-phase={phase} data-route-progress aria-hidden={hidden || undefined}>
      <div className={classes.bar} role="progressbar" aria-label={ariaLabel} aria-valuemin={0} aria-valuemax={100} />
    </div>
  );
}
