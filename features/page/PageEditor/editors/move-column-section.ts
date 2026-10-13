import type { ColumnData } from '../types';

/** Reorder a child within its column, or insert it into another column (including an empty one). */
export function moveColumnSection(
  columns: readonly ColumnData[],
  activeId: string,
  targetId: string,
): ColumnData[] | null {
  if (activeId === targetId) {
    return null;
  }
  const sourceIndex = columns.findIndex((column) => column.sections.some((section) => section.id === activeId));
  const targetIndex = columns.findIndex(
    (column) => column.id === targetId || column.sections.some((section) => section.id === targetId),
  );
  if (sourceIndex < 0 || targetIndex < 0) {
    return null;
  }
  const source = columns[sourceIndex]!;
  const target = columns[targetIndex]!;
  const sourceSectionIndex = source.sections.findIndex((section) => section.id === activeId);
  const moved = source.sections[sourceSectionIndex]!;
  const next = columns.map((column) => ({ ...column, sections: [...column.sections] }));
  next[sourceIndex]!.sections.splice(sourceSectionIndex, 1);
  const insertionIndex =
    target.id === targetId
      ? next[targetIndex]!.sections.length
      : target.sections.findIndex((section) => section.id === targetId);
  next[targetIndex]!.sections.splice(insertionIndex, 0, moved);
  return next;
}
