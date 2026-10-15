import { closestCorners, type KeyboardCoordinateGetter } from '@dnd-kit/core';

/** Align centers so differently sized disclosures reach the same drop target. */
export const verticalKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const { active, collisionRect, droppableContainers, droppableRects } = context;
  if (!active || !collisionRect || !['ArrowUp', 'ArrowDown'].includes(event.code)) {
    return undefined;
  }
  event.preventDefault();

  const candidates = droppableContainers.getEnabled().filter((container) => {
    const kind = active.data.current?.type;
    const targetKind = container.data.current?.type;
    if (kind !== targetKind && !(kind === 'item' && targetKind === 'group' && container.data.current?.empty)) {
      return false;
    }
    const rect = droppableRects.get(container.id);
    if (!rect) {
      return false;
    }
    return event.code === 'ArrowDown' ? rect.top > collisionRect.top : rect.top < collisionRect.top;
  });
  const collisions = closestCorners({
    active,
    collisionRect,
    droppableContainers: candidates,
    droppableRects,
    pointerCoordinates: null,
  });
  const target = collisions[0]?.id === context.over?.id && collisions.length > 1 ? collisions[1] : collisions[0];
  const rect = target && droppableRects.get(target.id);
  if (!rect) {
    return undefined;
  }
  return {
    x: rect.left + (rect.width - collisionRect.width) / 2,
    y: rect.top + (rect.height - collisionRect.height) / 2,
  };
};
