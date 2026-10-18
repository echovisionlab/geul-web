import type { UniqueIdentifier } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

export interface ReorderIntent {
  itemId: string;
  previousItemId?: string;
  nextItemId?: string;
}

/**
 * Moves the dragged item onto the drop target's position and names its new neighbours, which the release
 * relation actions use to apply the move against the latest server order. Returns null when the drop does
 * not change the order.
 */
export function reorderWithIntent<T>(
  items: T[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier | null | undefined,
  getId: (item: T) => string,
): { items: T[]; intent: ReorderIntent } | null {
  if (overId == null || activeId === overId) {
    return null;
  }
  const oldIndex = items.findIndex((item) => getId(item) === activeId);
  const newIndex = items.findIndex((item) => getId(item) === overId);
  if (oldIndex === -1 || newIndex === -1) {
    return null;
  }
  const reordered = arrayMove(items, oldIndex, newIndex);
  return {
    items: reordered,
    intent: {
      itemId: String(activeId),
      previousItemId: newIndex > 0 ? getId(reordered[newIndex - 1]) : undefined,
      nextItemId: newIndex + 1 < reordered.length ? getId(reordered[newIndex + 1]) : undefined,
    },
  };
}
