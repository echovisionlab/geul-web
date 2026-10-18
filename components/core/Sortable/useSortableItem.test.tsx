// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, type useSortable } from '@dnd-kit/sortable';
import { IconButton } from '../IconButton';
import { Table } from '../Display';
import { SortableSurface } from './SortableSurface';
import { useSortableItem, type SortableItemBinding } from './useSortableItem';

type SortableState = ReturnType<typeof useSortable>;
const control = vi.hoisted(() => ({ override: null as null | ((id: string) => Partial<SortableState>) }));

vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/sortable')>();
  return {
    ...actual,
    useSortable: (args: Parameters<typeof actual.useSortable>[0]) => {
      const state = actual.useSortable(args);
      return control.override ? { ...state, ...control.override(String(args.id)) } : state;
    },
  };
});

let container: HTMLDivElement | undefined;
let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = undefined;
  root = undefined;
  control.override = null;
});

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root!.render(node));
  return container;
}

function List({ children, ids }: { children: ReactNode; ids: string[] }) {
  return (
    <DndContext>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

function SurfaceItem({
  id,
  disabled,
  onBinding,
}: {
  id: string;
  disabled?: boolean;
  onBinding?: (binding: SortableItemBinding) => void;
}) {
  const sortable = useSortableItem({ id, disabled, data: { type: 'item' } });
  onBinding?.(sortable);
  return (
    <SortableSurface ref={sortable.setNodeRef} motion={sortable.motion}>
      <IconButton interaction="drag-handle" draggable={false} {...sortable.handle} aria-label={`Reorder ${id}`} />
      <span>{id}</span>
    </SortableSurface>
  );
}

describe('useSortableItem', () => {
  it('binds Dnd Kit attributes, listeners and the activator to the leading Core handle', () => {
    const html = render(
      <List ids={['first']}>
        <SurfaceItem id="first" />
      </List>,
    );
    const handle = html.querySelector('button')!;
    const surface = html.querySelector('[data-sortable-item]')!;
    expect(handle.getAttribute('aria-label')).toBe('Reorder first');
    expect(handle.getAttribute('aria-roledescription')).toBe('sortable');
    expect(handle.getAttribute('aria-describedby')).toMatch(/^DndDescribedBy-/);
    expect(handle.getAttribute('data-interaction')).toBe('drag-handle');
    // Sensor bindings never leak onto the moving surface.
    expect(surface.getAttribute('aria-roledescription')).toBeNull();
    expect(surface.getAttribute('style')).toBeNull();
  });

  it('reports a disabled entry on the handle', () => {
    const html = render(
      <List ids={['first']}>
        <SurfaceItem id="first" disabled />
      </List>,
    );
    expect(html.querySelector('button')!.getAttribute('aria-disabled')).toBe('true');
  });

  it('projects translate-only motion for SortableSurface and Table.Tr', () => {
    control.override = () => ({
      transform: { x: 4, y: 32, scaleX: 0.5, scaleY: 1.4 },
      transition: 'transform 200ms ease',
      isDragging: true,
    });
    let binding: SortableItemBinding | undefined;
    function Row() {
      const sortable = useSortableItem({ id: 'row' });
      binding = sortable;
      return (
        <Table>
          <Table.Tbody>
            <Table.Tr ref={sortable.setNodeRef} dragState={sortable.dragState}>
              <Table.Td>row</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      );
    }
    const html = render(
      <List ids={['row']}>
        <Row />
      </List>,
    );
    expect(binding!.isDragging).toBe(true);
    expect(binding!.dragState).toEqual({
      transform: 'translate3d(4px, 32px, 0)',
      transition: 'transform 200ms ease',
      dragging: true,
    });
    expect(binding!.motion.transform).toEqual({ x: 4, y: 32, scaleX: 0.5, scaleY: 1.4 });
    const row = html.querySelector('tr')!;
    expect(row.style.transform).toBe('translate3d(4px, 32px, 0)');
    expect(row.getAttribute('data-dragging')).toBe('true');
    expect(row.getAttribute('style')).not.toContain('scale');
  });
});
