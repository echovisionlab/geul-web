'use client';

import type { ReactNode } from 'react';
import { VisuallyHidden } from 'react-aria-components';
import { ToolbarDensityProvider, type ToolbarDensity } from '../control-context';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import classes from './ToolbarLayout.module.css';

export interface ToolbarLayoutProps extends PresentationProps {
  leading?: ReactNode;
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  arrangement?: 'flow' | 'actions-end' | 'actions-inline';
  density?: ToolbarDensity;
  justify?: 'between' | 'start' | 'end' | 'center';
  inset?: 'none' | 'content';
  divider?: 'none' | 'surface';
  description?: string;
}

/** Container-responsive controls use ordinary tab order; command toolbars use ToolbarSurface. */
export function ToolbarLayout({
  leading,
  search,
  filters,
  actions,
  children,
  arrangement = 'flow',
  density = 'compact',
  justify = 'between',
  inset = 'none',
  divider = 'none',
  description,
  ...props
}: ToolbarLayoutProps) {
  if (
    !['flow', 'actions-end', 'actions-inline'].includes(arrangement) ||
    !['compact', 'comfortable'].includes(density) ||
    !['between', 'start', 'end', 'center'].includes(justify) ||
    !['none', 'content'].includes(inset) ||
    !['none', 'surface'].includes(divider)
  ) {
    throw new RangeError('Invalid toolbar layout presentation');
  }
  return (
    <ToolbarDensityProvider density={density}>
      <div className={classes.container}>
        <div
          {...presentationAttributes(props)}
          className={classes.toolbar}
          data-arrangement={arrangement}
          data-density={density}
          data-justify={justify}
          data-inset={inset}
          data-divider={divider}
          data-has-leading={leading != null || undefined}
        >
          {description ? <VisuallyHidden>{description}</VisuallyHidden> : null}
          {arrangement === 'flow' ? (
            children
          ) : (
            <>
              {leading != null ? <div className={classes.leading}>{leading}</div> : null}
              {search != null ? <div className={classes.search}>{search}</div> : null}
              {filters != null ? <div className={classes.filters}>{filters}</div> : null}
              {actions != null ? <div className={classes.actions}>{actions}</div> : null}
            </>
          )}
        </div>
      </div>
    </ToolbarDensityProvider>
  );
}
