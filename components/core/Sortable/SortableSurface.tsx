'use client';

import { forwardRef } from 'react';
import type { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import classes from './SortableGroups.module.css';

/** Sensor geometry is data; Core owns the active surface and preserves its size. */
export interface SortableSurfaceProps extends PresentationProps {
  'data-sortable-item'?: never;
  'data-dragging'?: never;
  motion: Pick<ReturnType<typeof useSortable>, 'transform' | 'transition' | 'isDragging'>;
}

export const SortableSurface = forwardRef<HTMLDivElement, SortableSurfaceProps>(
  ({ motion: { transform, transition, isDragging }, children, ...props }, ref) => (
    <div
      {...presentationAttributes(props)}
      ref={ref}
      className={classes.item}
      data-sortable-item
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {children}
    </div>
  ),
);
SortableSurface.displayName = 'SortableSurface';
