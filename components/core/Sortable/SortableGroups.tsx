'use client';

import React, { useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconGripVertical } from '@tabler/icons-react';
import { Group, Text } from '@mantine/core';
import { SectionCard } from '../Section';

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
  renderGroup: (props: RenderGroupProps<G, T>) => ReactNode;
  renderItem: (props: RenderItemProps<T>) => ReactNode;
  getItemLabel?: (item: T) => string;
  getGroupLabel?: (group: G) => string;
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

function SortableItemWrapper<T extends SortableItem>({ id, item, groupId, renderItem }: SortableItemWrapperProps<T>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'item' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {renderItem({
        item,
        groupId,
        isDragging,
        dragHandleProps: { attributes, listeners },
      })}
    </div>
  );
}

// =============================================================================
// Sortable Group Wrapper
// =============================================================================

interface SortableGroupWrapperProps<G extends SortableGroup<T>, T extends SortableItem> {
  id: string;
  group: G;
  isDropTarget: boolean;
  children: ReactNode;
  renderGroup: (props: RenderGroupProps<G, T>) => ReactNode;
}

function SortableGroupWrapper<G extends SortableGroup<T>, T extends SortableItem>({
  id,
  group,
  isDropTarget,
  children,
  renderGroup,
}: SortableGroupWrapperProps<G, T>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'group' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {renderGroup({
        group,
        children,
        isDropTarget,
        isDragging,
        dragHandleProps: { attributes, listeners },
      })}
    </div>
  );
}

// =============================================================================
// SortableGroups Component
// =============================================================================

export function SortableGroups<G extends SortableGroup<T>, T extends SortableItem = SortableItem>({
  groups,
  onGroupsChange,
  renderGroup,
  renderItem,
  getItemLabel = (item) => item.id,
  getGroupLabel = (group) => group.id,
}: SortableGroupsProps<G, T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overGroupId, setOverGroupId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Generate IDs
  const groupIds = groups.map((g) => `group-${g.id}`);
  const itemIdsByGroup = groups.map((g) => g.items.map((item) => `item-${g.id}-${item.id}`));

  // Parse ID
  const parseId = (id: string) => {
    if (id.startsWith('group-')) {
      return { type: 'group' as const, groupId: id.replace('group-', '') };
    }
    if (id.startsWith('item-')) {
      const rest = id.replace('item-', '');
      const firstDash = rest.indexOf('-');
      const groupId = rest.substring(0, firstDash);
      const itemId = rest.substring(firstDash + 1);
      return { type: 'item' as const, groupId, itemId };
    }
    return null;
  };

  const findGroupIndex = (groupId: string) => groups.findIndex((g) => g.id === groupId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
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
    setActiveId(null);
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

      if (toGroupIndex === -1) {
        return;
      }

      const fromGroup = groups[fromGroupIndex];
      const fromItems = [...fromGroup.items];
      const fromItemIndex = fromItems.findIndex((item) => item.id === activeInfo.itemId);
      const [movedItem] = fromItems.splice(fromItemIndex, 1);

      if (fromGroupIndex === toGroupIndex) {
        // Same group reorder
        const adjustedIndex = fromItemIndex < toItemIndex ? toItemIndex - 1 : toItemIndex;
        fromItems.splice(adjustedIndex, 0, movedItem);
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

  // Get active drag label
  const getActiveLabel = () => {
    if (!activeId) {
      return null;
    }
    const info = parseId(activeId);
    if (!info) {
      return null;
    }

    if (info.type === 'group') {
      const group = groups.find((g) => g.id === info.groupId);
      return group ? getGroupLabel(group) : null;
    }
    if (info.type === 'item') {
      const group = groups.find((g) => g.id === info.groupId);
      const item = group?.items.find((i) => i.id === info.itemId);
      return item ? getItemLabel(item) : null;
    }
    return null;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
        {groups.map((group, groupIndex) => (
          <SortableGroupWrapper
            key={group.id}
            id={`group-${group.id}`}
            group={group}
            isDropTarget={overGroupId === group.id}
            renderGroup={renderGroup}
          >
            <SortableContext items={itemIdsByGroup[groupIndex]} strategy={verticalListSortingStrategy}>
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
          </SortableGroupWrapper>
        ))}
      </SortableContext>

      <DragOverlay>
        {activeId && (
          <SectionCard p="xs" shadow="md" style={{ cursor: 'grabbing' }}>
            <Group gap="xs">
              <IconGripVertical size={14} />
              <Text size="sm" fw={500}>
                {getActiveLabel()}
              </Text>
            </Group>
          </SectionCard>
        )}
      </DragOverlay>
    </DndContext>
  );
}
