import type { CSSProperties, ReactNode } from 'react';
import type { ClosedVisualProps } from '../visual-contract';
import { isSpace, spaceValue, type Space } from './layout-contract';
import classes from './Layout.module.css';

export interface LayoutBleedProps extends ClosedVisualProps {
  children: ReactNode;
  inline: Space;
}

/** Compensates an outer inset when embedded content already owns that inset. */
export function LayoutBleed({ children, inline }: LayoutBleedProps) {
  if (!isSpace(inline)) {
    throw new RangeError('LayoutBleed inline must use registered spacing.');
  }
  return (
    <div
      className={`${classes.root} ${classes.bleed}`}
      style={{ '--_layout-bleed': spaceValue(inline) } as CSSProperties}
    >
      {children}
    </div>
  );
}
