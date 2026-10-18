// @vitest-environment jsdom

import { act, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DndContextProps, DragOverEvent } from '@dnd-kit/core';
import { SortableGroups, type SortableGroup, type SortableItem } from './SortableGroups';

const motion = vi.hoisted(() => {
  const subscribers = new Set<() => void>();
  const states = new Map<
    string,
    {
      attributes: Record<string, unknown>;
      listeners: undefined;
      setNodeRef: () => void;
      transform: { x: number; y: number; scaleX: number; scaleY: number } | null;
      transition: undefined;
      isDragging: boolean;
    }
  >();
  const setNodeRef = () => {};
  return {
    subscribers,
    states,
    props: null as DndContextProps | null,
    get(id: string) {
      if (!states.has(id)) {
        states.set(id, {
          attributes: {},
          listeners: undefined,
          setNodeRef,
          transform: null,
          transition: undefined,
          isDragging: false,
        });
      }
      return states.get(id)!;
    },
  };
});

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: (props: DndContextProps) => {
      motion.props = props;
      return <div>{props.children}</div>;
    },
    pointerWithin: () => [],
    closestCenter: () => [],
  };
});

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: <T,>(items: T[], from: number, to: number) => {
    const result = [...items];
    result.splice(to, 0, ...result.splice(from, 1));
    return result;
  },
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSortable: ({ id }: { id: string }) =>
    useSyncExternalStore(
      (listener) => {
        motion.subscribers.add(listener);
        return () => motion.subscribers.delete(listener);
      },
      () => motion.get(id),
      () => motion.get(id),
    ),
  verticalListSortingStrategy: {},
}));

let container: HTMLDivElement | undefined;
let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  motion.states.clear();
  motion.subscribers.clear();
});

describe('SortableGroups motion rendering', () => {
  const groups: SortableGroup[] = [
    { id: 'details', items: Array.from({ length: 20 }, (_, index) => ({ id: `field-${index}` })) },
    { id: 'empty', items: [] },
  ];
  function mount() {
    const renderGroup = vi.fn(({ group, children }: { group: SortableGroup; children: React.ReactNode }) => (
      <section aria-label={group.id}>{children}</section>
    ));
    const renderItem = vi.fn(({ item }: { item: SortableItem }) => <span>{item.id}</span>);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const rerender = (source = groups, itemRenderer = renderItem) =>
      act(() =>
        root!.render(
          <SortableGroups
            groups={source}
            onGroupsChange={() => {}}
            getGroupLabel={(group) => group.id}
            getItemLabel={(item) => item.id}
            renderGroup={renderGroup}
            renderItem={itemRenderer}
          />,
        ),
      );
    rerender();
    return { renderGroup, renderItem, rerender };
  }
  function frame(index: number) {
    act(() => {
      for (const [id, state] of motion.states) {
        motion.states.set(id, { ...state, transform: { x: 0, y: index * 3, scaleX: 1, scaleY: 1 } });
      }
      for (const listener of motion.subscribers) {
        listener();
      }
    });
  }
  it('updates live transforms without re-rendering unchanged domain content', () => {
    const { renderGroup, renderItem } = mount();
    expect(renderGroup).toHaveBeenCalledTimes(2);
    expect(renderItem).toHaveBeenCalledTimes(20);
    renderGroup.mockClear();
    renderItem.mockClear();
    for (let index = 1; index <= 4; index += 1) {
      frame(index);
    }
    expect(container!.querySelector<HTMLElement>('[data-sortable-item]')!.style.transform).toContain('12px');
    expect({ groupRenders: renderGroup.mock.calls.length, itemRenders: renderItem.mock.calls.length }).toEqual({
      groupRenders: 0,
      itemRenders: 0,
    });
  });
  it('updates the active content when drag state changes and only the affected drop-target group', () => {
    const { renderGroup, renderItem } = mount();
    renderGroup.mockClear();
    renderItem.mockClear();
    act(() => {
      const id = 'item-details-field-0';
      motion.states.set(id, { ...motion.get(id), attributes: { 'aria-pressed': true }, isDragging: true });
      for (const listener of motion.subscribers) {
        listener();
      }
    });
    expect(renderItem).toHaveBeenCalledTimes(1);
    expect(renderItem.mock.calls[0][0].item.id).toBe('field-0');
    expect(renderGroup).not.toHaveBeenCalled();
    renderItem.mockClear();
    act(() =>
      motion.props!.onDragOver!({
        active: { id: 'item-details-field-0' },
        over: { id: 'group-empty' },
      } as DragOverEvent),
    );
    expect(renderGroup).toHaveBeenCalledTimes(1);
    expect(renderGroup.mock.calls[0][0].group.id).toBe('empty');
    expect(renderItem).not.toHaveBeenCalled();
  });

  it('delivers changed source objects and changed renderer callbacks without stale content', () => {
    const { renderGroup, renderItem, rerender } = mount();
    renderGroup.mockClear();
    renderItem.mockClear();
    const updated = { ...groups[0].items[0] };
    const source = [{ ...groups[0], items: [updated, ...groups[0].items.slice(1)] }, groups[1]];
    rerender(source);
    expect(renderItem).toHaveBeenCalledTimes(1);
    expect(renderItem.mock.calls[0][0].item).toBe(updated);
    expect(renderGroup).toHaveBeenCalledTimes(1);
    const translated = vi.fn(({ item }: { item: SortableItem }) => <span>{item.id} translated</span>);
    rerender(source, translated);
    expect(translated).toHaveBeenCalledTimes(20);
    expect(container!.textContent).toContain('field-0 translated');
  });
});
