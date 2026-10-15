import { IconChevronDown } from '@tabler/icons-react';
import classes from './Control.module.css';

export type ControlIndicatorKind = 'menu' | 'disclosure';

/** Trailing opening affordance. The control's aria-expanded state owns rotation. */
export function ControlIndicator({ kind }: { kind: ControlIndicatorKind }) {
  return <IconChevronDown className={classes.indicator} data-control-indicator={kind} aria-hidden />;
}
