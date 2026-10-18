import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { DndContextProps, DragEndEvent } from '@dnd-kit/core';

import { SortableGroups, type SortableGroup, type SortableItem } from './SortableGroups';

const dnd = vi.hoisted(() => ({ props: null as DndContextProps | null }));

vi.mock('@dnd-kit/core', () => ({
  DndContext: (props: DndContextProps) => {
    dnd.props = props;
    return <div>{props.children}</div>;
  },
  DragOverlay: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  KeyboardSensor: function KeyboardSensor() {},
  PointerSensor: function PointerSensor() {},
  pointerWithin: vi.fn(() => []),
  closestCenter: vi.fn(() => [{ id: 'keyboard-target' }]),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: <T,>(items: T[]) => items,
  SortableContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: undefined,
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Translate: { toString: () => undefined } },
}));

describe('SortableGroups', () => {
  function renderSorting(groups: SortableGroup[], onGroupsChange = vi.fn()) {
    renderToStaticMarkup(
      <SortableGroups
        groups={groups}
        onGroupsChange={onGroupsChange}
        getGroupLabel={(group) => group.id.replaceAll('-', ' ')}
        getItemLabel={(item) => item.id.replaceAll('-', ' ')}
        renderGroup={({ children }) => <section>{children}</section>}
        renderItem={({ item }) => <div>{item.id}</div>}
      />,
    );
    return onGroupsChange;
  }

  function drop(active: string, over: string) {
    dnd.props!.onDragEnd!({ active: { id: active }, over: { id: over } } as DragEndEvent);
  }

  it('announces names, positions, destinations and cancellation without leaking generated drag IDs', () => {
    renderSorting([
      { id: 'step-one', items: [{ id: 'field-name' }, { id: 'field-email' }] },
      { id: 'step-two', items: [] },
    ]);
    const announcements = dnd.props!.accessibility!.announcements!;
    const active = { id: 'item-step-one-field-name' };
    expect(announcements.onDragStart!({ active } as never)).toBe('Picked up field name, position 1 of 2, step one.');
    expect(announcements.onDragOver!({ active, over: { id: 'group-step-two' } } as never)).toBe(
      'field name, position 1 of 2, step one moved over step two, position 2 of 2.',
    );
    expect(announcements.onDragEnd!({ active, over: null } as never)).toBe(
      'field name, position 1 of 2, step one dropped without a change.',
    );
    expect(announcements.onDragCancel!({ active } as never)).toContain(
      'field name, position 1 of 2, step one returned to its original position',
    );
    expect(dnd.props!.accessibility!.restoreFocus).toBe(true);
  });

  it('moves a field down onto the next field rather than leaving it in place', () => {
    const changed = renderSorting([{ id: 'details', items: [{ id: 'name' }, { id: 'email' }, { id: 'phone' }] }]);
    drop('item-details-name', 'item-details-email');
    expect(changed.mock.calls[0][0][0].items.map((item: SortableItem) => item.id)).toEqual(['email', 'name', 'phone']);
  });

  it('resolves step and field identifiers containing hyphens when moving between steps', () => {
    const changed = renderSorting([
      { id: 'step-one', items: [{ id: 'field-name' }] },
      { id: 'step-two', items: [{ id: 'field-email' }] },
    ]);
    drop('item-step-one-field-name', 'group-step-two');
    expect(changed.mock.calls[0][0]).toEqual([
      { id: 'step-one', items: [] },
      { id: 'step-two', items: [{ id: 'field-email' }, { id: 'field-name' }] },
    ]);
  });
});
