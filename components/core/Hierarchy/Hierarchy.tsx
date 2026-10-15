'use client';

import { createContext, forwardRef, useContext, type CSSProperties } from 'react';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import { isSpace, spaceValue, type Space } from '../Layout/layout-contract';
import classes from './Hierarchy.module.css';

const HierarchySpacing = createContext<Space | undefined>(undefined);

/** An omitted spacing consumes the system default; overrides use the existing named scale. */
export function useHierarchyStep() {
  const spacing = useContext(HierarchySpacing);
  return spacing === undefined ? 'var(--geul-hierarchy-step)' : spaceValue(spacing);
}

export interface HierarchyProps extends PresentationProps {
  spacing?: Space;
  'data-geul-hierarchy'?: never;
}

export function Hierarchy({ spacing, children, ...props }: HierarchyProps) {
  const inheritedSpacing = useContext(HierarchySpacing);
  if (spacing !== undefined && !isSpace(spacing)) {
    throw new RangeError('Hierarchy spacing must use the system spacing scale');
  }
  const resolvedSpacing = spacing ?? inheritedSpacing;
  return (
    <HierarchySpacing.Provider value={resolvedSpacing}>
      <div
        {...presentationAttributes(props)}
        className={classes.root}
        data-geul-hierarchy
        style={
          {
            '--_hierarchy-step':
              resolvedSpacing === undefined ? 'var(--geul-hierarchy-step)' : spaceValue(resolvedSpacing),
          } as CSSProperties
        }
      >
        {children}
      </div>
    </HierarchySpacing.Provider>
  );
}

export interface HierarchyIndentProps extends PresentationProps {
  enabled?: boolean;
  alignment?: 'content' | 'parent-label';
  'data-geul-hierarchy-indent'?: never;
}

/** One child level, or the existing compact reorder label track. */
export const HierarchyIndent = forwardRef<HTMLDivElement, HierarchyIndentProps>(
  ({ enabled = true, alignment = 'content', children, ...props }, ref) => {
    const step = useHierarchyStep();
    if (alignment !== 'content' && alignment !== 'parent-label') {
      throw new RangeError('Hierarchy alignment must be content or parent-label');
    }
    return (
      <div
        {...presentationAttributes(props)}
        ref={ref}
        className={`${classes.root} ${classes.indent}`}
        data-geul-hierarchy-indent={enabled ? alignment : 'none'}
        style={{ '--_hierarchy-step': step } as CSSProperties}
      >
        {children}
      </div>
    );
  },
);
HierarchyIndent.displayName = 'HierarchyIndent';
