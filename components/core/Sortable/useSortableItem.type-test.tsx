import { IconButton } from '../IconButton';
import { Table } from '../Display';
import { SortableSurface } from './SortableSurface';
import { useSortableItem, type SortableHandleBinding, type SortableItemBinding } from './useSortableItem';

function SurfaceRow() {
  const sortable: SortableItemBinding = useSortableItem({ id: 'item', data: { type: 'item' }, disabled: false });
  return (
    <SortableSurface ref={sortable.setNodeRef} motion={sortable.motion}>
      <IconButton interaction="drag-handle" draggable={false} {...sortable.handle} aria-label="Reorder item" />
    </SortableSurface>
  );
}

function TableRow() {
  const sortable = useSortableItem({ id: 7 });
  return <Table.Tr ref={sortable.setNodeRef} dragState={sortable.dragState} />;
}

declare const handle: SortableHandleBinding;
const describedBy: string = handle['aria-describedby'];
// @ts-expect-error The handle binding never carries presentation.
handle.style = { cursor: 'grab' };
// @ts-expect-error Sorting strategy and sensors belong to the list context, not one item.
useSortableItem({ id: 'item', strategy: undefined });
// @ts-expect-error Item identity is required.
useSortableItem({ disabled: true });

export { SurfaceRow, TableRow, describedBy };
