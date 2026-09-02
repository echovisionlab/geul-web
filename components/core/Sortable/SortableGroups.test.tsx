import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { SortableGroups, type SortableGroup, type SortableItem } from './SortableGroups';

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  KeyboardSensor: function KeyboardSensor() {},
  PointerSensor: function PointerSensor() {},
  pointerWithin: vi.fn(),
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
  CSS: { Transform: { toString: () => undefined } },
}));

describe('SortableGroups', () => {
  it('keeps domain content in caller-provided group and item renderers', () => {
    interface TestItem extends SortableItem {
      name: string;
    }

    interface TestGroup extends SortableGroup<TestItem> {
      id: string;
    }

    const html = renderToStaticMarkup(
      <MantineProvider>
        <SortableGroups<TestGroup, TestItem>
          groups={[{ id: 'group', items: [{ id: 'item', name: 'Domain item' }] }]}
          onGroupsChange={vi.fn()}
          renderGroup={({ group, children }) => (
            <section>
              <h2>{group.id}</h2>
              {children}
            </section>
          )}
          renderItem={({ item }) => <div>{String(item.name)}</div>}
        />
      </MantineProvider>,
    );

    expect(html).toContain('<h2>group</h2>');
    expect(html).toContain('Domain item');
  });
});
