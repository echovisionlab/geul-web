'use client';

import { useMemo } from 'react';
import type { Data, DraggableAttributes, UniqueIdentifier } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { interactionBindings, type InteractionBindings } from '../bindings';
import type { SortableSurfaceProps } from './SortableSurface';

/** Feature data for one sortable entry. Sorting strategy and sensors stay on the list's DndContext. */
export interface UseSortableItemOptions {
  id: UniqueIdentifier;
  data?: Data;
  disabled?: boolean;
}

/**
 * Spread onto the leading Core drag handle (`IconButton interaction="drag-handle"`).
 * Carries the activator ref, Dnd Kit's accessible attributes and its pointer/keyboard listeners;
 * never styles or Core state markers.
 */
export type SortableHandleBinding = InteractionBindings<DraggableAttributes> & {
  ref: (element: HTMLElement | null) => void;
};

/** Translate-only projection consumed by Core `Table.Tr` `dragState`. */
export interface SortableRowDragState {
  transform: string | undefined;
  transition: string | undefined;
  dragging: boolean;
}

export interface SortableItemBinding {
  /** Attach to the moving Core surface (`SortableSurface` or `Table.Tr`). */
  setNodeRef: (element: HTMLElement | null) => void;
  isDragging: boolean;
  /** `SortableSurface` `motion`. */
  motion: SortableSurfaceProps['motion'];
  /** `Table.Tr` `dragState`; the sensor scale is never applied. */
  dragState: SortableRowDragState;
  /** Leading drag handle binding. */
  handle: SortableHandleBinding;
}

/**
 * Item-level sortable wiring for Core reorder surfaces. Each returned object keeps its identity
 * until its own inputs change, so memoized rows can depend on `handle` without re-rendering for
 * unrelated motion updates.
 */
export function useSortableItem({ id, data, disabled }: UseSortableItemOptions): SortableItemBinding {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data,
    disabled,
  });
  const handle = useMemo<SortableHandleBinding>(
    () => ({ ...interactionBindings(attributes), ...interactionBindings(listeners), ref: setActivatorNodeRef }),
    [attributes, listeners, setActivatorNodeRef],
  );
  const motion = useMemo(() => ({ transform, transition, isDragging }), [transform, transition, isDragging]);
  const dragState = useMemo(
    () => ({ transform: CSS.Translate.toString(transform), transition, dragging: isDragging }),
    [transform, transition, isDragging],
  );
  return useMemo(
    () => ({ setNodeRef, isDragging, motion, dragState, handle }),
    [setNodeRef, isDragging, motion, dragState, handle],
  );
}
