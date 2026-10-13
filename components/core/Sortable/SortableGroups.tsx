'use client';

import React, { useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type DndContextProps,
  type DragEndEvent,
  type DraggableAttributes,
  type DragOverEvent,
} from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableSurface } from './SortableSurface';
import { verticalKeyboardCoordinates } from './verticalKeyboardCoordinates';

// =============================================================================
// Types
// =============================================================================

export interface SortableItem {
  id: string;
}

export interface SortableGroup<T extends SortableItem = SortableItem> {
  id: string;
  items: T[];
}

export interface DragHandleProps {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
}

export interface RenderGroupProps<G extends SortableGroup<T>, T extends SortableItem = SortableItem> {
  group: G;
  children: ReactNode;
  isDropTarget: boolean;
  isDragging: boolean;
  dragHandleProps: DragHandleProps;
}

export interface RenderItemProps<T extends SortableItem> {
  item: T;
  groupId: string;
  isDragging: boolean;
  dragHandleProps: DragHandleProps;
}

export interface SortableGroupsProps<G extends SortableGroup<T>, T extends SortableItem = SortableItem> {
  groups: G[];
  onGroupsChange: (groups: G[]) => void;
  getGroupLabel: (group: G) => string;
  getItemLabel: (item: T, group: G) => string;
  accessibility?: {
    instructions?: string;
    announcements?: NonNullable<DndContextProps['accessibility']>['announcements'];
  };
  renderGroup: (props: RenderGroupProps<G, T>) => ReactNode;
  renderItem: (props: RenderItemProps<T>) => ReactNode;
}

// =============================================================================
// Sortable Item Wrapper
// =============================================================================

interface SortableItemWrapperProps<T extends SortableItem> {
  id: string;
  item: T;
  groupId: string;
  renderItem: (props: RenderItemProps<T>) => ReactNode;
}

function SortableItemContent<T extends SortableItem>({
  renderItem,
  ...props
}: RenderItemProps<T> & Pick<SortableItemWrapperProps<T>, 'renderItem'>) {
  return renderItem(props);
}
const MemoizedSortableItemContent = React.memo(SortableItemContent) as typeof SortableItemContent;

function SortableItemWrapper<T extends SortableItem>({ id, item, groupId, renderItem }: SortableItemWrapperProps<T>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'item' },
  });
  const dragHandleProps = useMemo(() => ({ attributes, listeners }), [attributes, listeners]);

  return (
    <SortableSurface ref={setNodeRef} motion={{ transform, transition, isDragging }}>
      <MemoizedSortableItemContent
        item={item}
        groupId={groupId}
        isDragging={isDragging}
        dragHandleProps={dragHandleProps}
        renderItem={renderItem}
      />
    </SortableSurface>
  );
}

// =============================================================================
// Sortable Group Wrapper
// =============================================================================

interface SortableGroupWrapperProps<G extends SortableGroup<T>, T extends SortableItem> {
  id: string;
  group: G;
  isDropTarget: boolean;
  renderGroup: (props: RenderGroupProps<G, T>) => ReactNode;
  renderItem: (props: RenderItemProps<T>) => ReactNode;
}

function SortableGroupContent<G extends SortableGroup<T>, T extends SortableItem>({
  renderGroup,
  ...props
}: RenderGroupProps<G, T> & Pick<SortableGroupWrapperProps<G, T>, 'renderGroup'>) {
  return renderGroup(props);
}
const MemoizedSortableGroupContent = React.memo(SortableGroupContent) as typeof SortableGroupContent;

function SortableGroupWrapper<G extends SortableGroup<T>, T extends SortableItem>({
  id,
  group,
  isDropTarget,
  renderGroup,
  renderItem,
}: SortableGroupWrapperProps<G, T>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'group', empty: group.items.length === 0 },
  });
  const dragHandleProps = useMemo(() => ({ attributes, listeners }), [attributes, listeners]);
  // Dnd context still updates every sortable shell. Keep unchanged editor content
  // and its item collection stable while transform/transition values change.
  const children = useMemo(
    () => (
      <SortableContext
        items={group.items.map((item) => `item-${group.id}-${item.id}`)}
        strategy={verticalListSortingStrategy}
      >
        {group.items.map((item) => (
          <SortableItemWrapper
            key={item.id}
            id={`item-${group.id}-${item.id}`}
            item={item}
            groupId={group.id}
            renderItem={renderItem}
          />
        ))}
      </SortableContext>
    ),
    [group.id, group.items, renderItem],
  );

  return (
    <SortableSurface ref={setNodeRef} motion={{ transform, transition, isDragging }}>
      <MemoizedSortableGroupContent
        group={group}
        isDropTarget={isDropTarget}
        isDragging={isDragging}
        dragHandleProps={dragHandleProps}
        renderGroup={renderGroup}
      >
        {children}
      </MemoizedSortableGroupContent>
    </SortableSurface>
  );
}

// =============================================================================
// SortableGroups Component
// =============================================================================

// Dnd Kit memoizes sensor descriptors by options identity. Keep this fixed
// interaction policy stable so parent renders do not replace every activator.
const pointerSensorOptions = { activationConstraint: { distance: 8 } };
const keyboardSensorOptions = { coordinateGetter: verticalKeyboardCoordinates };

export function SortableGroups<G extends SortableGroup<T>, T extends SortableItem = SortableItem>({
  groups,
  onGroupsChange,
  getGroupLabel,
  getItemLabel,
  accessibility,
  renderGroup,
  renderItem,
}: SortableGroupsProps<G, T>) {
  const [overGroupId, setOverGroupId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, pointerSensorOptions),
    useSensor(KeyboardSensor, keyboardSensorOptions),
  );

  // Generate IDs
  const groupIds = useMemo(() => groups.map((group) => `group-${group.id}`), [groups]);

  // Resolve against source data: both group and item IDs may contain hyphens.
  const parseId = (id: string) => {
    for (const group of groups) {
      if (id === `group-${group.id}`) {
        return { type: 'group' as const, groupId: group.id };
      }
      for (const item of group.items) {
        if (id === `item-${group.id}-${item.id}`) {
          return { type: 'item' as const, groupId: group.id, itemId: item.id };
        }
      }
    }
    return null;
  };

  const findGroupIndex = (groupId: string) => groups.findIndex((g) => g.id === groupId);

  // Announce domain labels and positions, never generated draggable identifiers.
  const describe = (id: string | number) => {
    const info = parseId(String(id));
    if (!info) {
      return undefined;
    }
    const groupIndex = findGroupIndex(info.groupId);
    const group = groups[groupIndex];
    if (info.type === 'group') {
      return `${getGroupLabel(group)}, position ${groupIndex + 1} of ${groups.length}`;
    }
    const itemIndex = group.items.findIndex((item) => item.id === info.itemId);
    return `${getItemLabel(group.items[itemIndex], group)}, position ${itemIndex + 1} of ${group.items.length}, ${getGroupLabel(group)}`;
  };
  const announcements: NonNullable<DndContextProps['accessibility']>['announcements'] = {
    onDragStart: ({ active }) => {
      const label = describe(active.id);
      return label ? `Picked up ${label}.` : undefined;
    },
    onDragOver: ({ active, over }) => {
      const label = describe(active.id);
      if (!label) {
        return undefined;
      }
      const target = over ? describe(over.id) : undefined;
      return target ? `${label} moved over ${target}.` : `${label} is no longer over a drop target.`;
    },
    onDragEnd: ({ active, over }) => {
      const label = describe(active.id);
      if (!label) {
        return undefined;
      }
      const target = over ? describe(over.id) : undefined;
      return target ? `${label} dropped at ${target}.` : `${label} dropped without a change.`;
    },
    onDragCancel: ({ active }) => {
      const label = describe(active.id);
      return label ? `Reordering cancelled. ${label} returned to its original position.` : undefined;
    },
    ...accessibility?.announcements,
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setOverGroupId(null);
      return;
    }

    const activeInfo = parseId(active.id as string);
    const overInfo = parseId(over.id as string);

    // Show drop target when dragging item over different group
    if (activeInfo?.type === 'item' && overInfo?.type === 'group' && activeInfo.groupId !== overInfo.groupId) {
      setOverGroupId(overInfo.groupId);
    } else {
      setOverGroupId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setOverGroupId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const activeInfo = parseId(active.id as string);
    const overInfo = parseId(over.id as string);

    if (!activeInfo || !overInfo) {
      return;
    }

    // Group reordering
    if (activeInfo.type === 'group' && overInfo.type === 'group') {
      const oldIndex = findGroupIndex(activeInfo.groupId);
      const newIndex = findGroupIndex(overInfo.groupId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        onGroupsChange(arrayMove(groups, oldIndex, newIndex));
      }
      return;
    }

    // Item reordering or moving between groups
    if (activeInfo.type === 'item') {
      const fromGroupIndex = findGroupIndex(activeInfo.groupId);
      if (fromGroupIndex === -1) {
        return;
      }

      let toGroupIndex: number;
      let toItemIndex: number;

      if (overInfo.type === 'item') {
        toGroupIndex = findGroupIndex(overInfo.groupId);
        const toGroup = groups[toGroupIndex];
        if (!toGroup) {
          return;
        }
        toItemIndex = toGroup.items.findIndex((item) => item.id === overInfo.itemId);
      } else if (overInfo.type === 'group') {
        toGroupIndex = findGroupIndex(overInfo.groupId);
        if (fromGroupIndex === toGroupIndex) {
          return;
        }
        toItemIndex = groups[toGroupIndex].items.length;
      } else {
        return;
      }

      if (toGroupIndex === -1 || toItemIndex === -1) {
        return;
      }

      const fromGroup = groups[fromGroupIndex];
      const fromItems = [...fromGroup.items];
      const fromItemIndex = fromItems.findIndex((item) => item.id === activeInfo.itemId);
      if (fromItemIndex === -1) {
        return;
      }
      const [movedItem] = fromItems.splice(fromItemIndex, 1);

      if (fromGroupIndex === toGroupIndex) {
        // Same group reorder
        fromItems.splice(toItemIndex, 0, movedItem);
        const newGroups = [...groups];
        newGroups[fromGroupIndex] = { ...fromGroup, items: fromItems } as G;
        onGroupsChange(newGroups);
      } else {
        // Move to different group
        const toGroup = groups[toGroupIndex];
        const toItems = [...toGroup.items];
        toItems.splice(toItemIndex, 0, movedItem);

        const newGroups = [...groups];
        newGroups[fromGroupIndex] = { ...fromGroup, items: fromItems } as G;
        newGroups[toGroupIndex] = { ...toGroup, items: toItems } as G;
        onGroupsChange(newGroups);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        announcements,
        ...(accessibility?.instructions ? { screenReaderInstructions: { draggable: accessibility.instructions } } : {}),
        restoreFocus: true,
      }}
      collisionDetection={(args) => {
        const pointerCollisions = pointerWithin(args);
        // Keyboard dragging has no pointer coordinates.
        return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
      }}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setOverGroupId(null);
      }}
    >
      <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
        {groups.map((group) => (
          <SortableGroupWrapper
            key={group.id}
            id={`group-${group.id}`}
            group={group}
            isDropTarget={overGroupId === group.id}
            renderGroup={renderGroup}
            renderItem={renderItem}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
