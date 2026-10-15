import { forwardRef, type ReactNode } from 'react';
import { primitiveTokens } from '../design-tokens';
import { projectLayoutAttributes, type LayoutBreakpoint, type LayoutNativeProps } from './layout-contract';
import classes from './LayoutVisibility.module.css';

export interface LayoutVisibilityProps extends LayoutNativeProps {
  children?: ReactNode;
  visibleFrom?: LayoutBreakpoint;
  hiddenFrom?: LayoutBreakpoint;
}
/** A semantic grouping wrapper; visibility uses the registered breakpoint authority. */
export const LayoutVisibility = forwardRef<HTMLDivElement, LayoutVisibilityProps>(
  ({ children, visibleFrom, hiddenFrom, ...props }, ref) => {
    for (const value of [visibleFrom, hiddenFrom]) {
      if (value !== undefined && !Object.hasOwn(primitiveTokens.breakpoints, value)) {
        throw new TypeError('LayoutVisibility requires a registered breakpoint');
      }
    }
    return (
      <div
        {...projectLayoutAttributes(props)}
        ref={ref}
        className={classes.root}
        data-visible-from={visibleFrom}
        data-hidden-from={hiddenFrom}
      >
        {children}
      </div>
    );
  },
);
LayoutVisibility.displayName = 'LayoutVisibility';
