import classes from './RouteProgressBar.module.css';
import { Progress } from './Progress';

export type RouteProgressBarPhase = 'idle' | 'waiting' | 'loading' | 'completing';

export interface RouteProgressBarProps {
  'aria-label': string;
  phase: RouteProgressBarPhase;
}

export function RouteProgressBar({ 'aria-label': ariaLabel, phase }: RouteProgressBarProps) {
  const hidden = phase === 'idle' || phase === 'waiting';

  return (
    <div className={classes.root} data-phase={phase} data-route-progress aria-hidden={hidden || undefined}>
      <Progress hidden={hidden} size="xs" value={phase === 'completing' ? 100 : null} aria-label={ariaLabel} />
    </div>
  );
}
