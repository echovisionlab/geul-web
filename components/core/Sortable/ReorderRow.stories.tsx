import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { IconGripVertical } from '@tabler/icons-react';
import { ReorderRow } from './ReorderRow';
import { SortableSurface } from './SortableSurface';
import { useSortableItem } from './useSortableItem';
import { verticalKeyboardCoordinates } from './verticalKeyboardCoordinates';
import { IconButton } from '../IconButton';
import { LayoutStack } from '../Layout';
import { TextInput } from '../Input';
const meta = {
  title: 'Core/Interaction/ReorderRow',
  component: ReorderRow,
  parameters: { layout: 'padded' },
  args: {
    handle: (
      <IconButton label="Reorder" interaction="drag-handle" disabled>
        <IconGripVertical aria-hidden />
      </IconButton>
    ),
    children: <TextInput size="xs" label="Item" defaultValue="Field recording" />,
  },
} satisfies Meta<typeof ReorderRow>;
export default meta;
export const Compact: StoryObj<typeof meta> = {};
export const Child: StoryObj<typeof meta> = { args: { indent: 'parent-label' } };

function SortableEntry({ id }: { id: string }) {
  // Item wiring comes from Core; the feature supplies only identity, label and content.
  const sortable = useSortableItem({ id });
  return (
    <SortableSurface ref={sortable.setNodeRef} motion={sortable.motion}>
      <ReorderRow
        handle={
          <IconButton interaction="drag-handle" draggable={false} {...sortable.handle} aria-label={`Reorder ${id}`}>
            <IconGripVertical aria-hidden />
          </IconButton>
        }
      >
        <TextInput size="xs" label="Item" defaultValue={id} />
      </ReorderRow>
    </SortableSurface>
  );
}
const pointerSensorOptions = { activationConstraint: { distance: 8 } };
const keyboardSensorOptions = { coordinateGetter: verticalKeyboardCoordinates };
function SortableEntries() {
  const [ids, setIds] = useState(['Field recording', 'Interview', 'Ambient bed']);
  const sensors = useSensors(
    useSensor(PointerSensor, pointerSensorOptions),
    useSensor(KeyboardSensor, keyboardSensorOptions),
  );
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over.id) {
          setIds((current) => arrayMove(current, current.indexOf(String(active.id)), current.indexOf(String(over.id))));
        }
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <LayoutStack gap="xxs">
          {ids.map((id) => (
            <SortableEntry key={id} id={id} />
          ))}
        </LayoutStack>
      </SortableContext>
    </DndContext>
  );
}
/** `useSortableItem` binds the moving surface and the leading handle to one sortable entry. */
export const SortableItemHook: StoryObj<typeof meta> = {
  render: () => <SortableEntries />,
  play: async ({ canvasElement }) => {
    const handle = within(canvasElement).getByRole('button', { name: 'Reorder Interview' });
    await expect(handle).toHaveAttribute('aria-roledescription', 'sortable');
    await expect(handle.closest('[data-sortable-item]')).not.toHaveAttribute('aria-roledescription');
  },
};
