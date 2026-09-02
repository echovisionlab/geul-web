export type TiptapSlashNavigationCommand = 'none' | 'move' | 'activate' | 'dismiss';

export interface TiptapSlashNavigationResult {
  command: TiptapSlashNavigationCommand;
  activeIndex: number;
  preventDefault: boolean;
}

function normalizedIndex(activeIndex: number, itemCount: number): number {
  if (itemCount <= 0) {
    return 0;
  }
  return ((activeIndex % itemCount) + itemCount) % itemCount;
}

/** Pure key adapter used while focus remains in the ProseMirror editor. */
export function reduceTiptapSlashNavigation({
  key,
  activeIndex,
  itemCount,
  isComposing = false,
  editorIsComposing = false,
}: {
  key: string;
  activeIndex: number;
  itemCount: number;
  isComposing?: boolean;
  editorIsComposing?: boolean;
}): TiptapSlashNavigationResult {
  const current = normalizedIndex(activeIndex, itemCount);
  if (isComposing || editorIsComposing) {
    return { command: 'none', activeIndex: current, preventDefault: false };
  }
  if (key === 'Escape') {
    return { command: 'dismiss', activeIndex: current, preventDefault: true };
  }
  if (itemCount <= 0) {
    return { command: 'none', activeIndex: 0, preventDefault: false };
  }
  if (key === 'ArrowDown') {
    return { command: 'move', activeIndex: (current + 1) % itemCount, preventDefault: true };
  }
  if (key === 'ArrowUp') {
    return { command: 'move', activeIndex: (current + itemCount - 1) % itemCount, preventDefault: true };
  }
  if (key === 'Home' || key === 'PageUp') {
    return { command: 'move', activeIndex: 0, preventDefault: true };
  }
  if (key === 'End' || key === 'PageDown') {
    return { command: 'move', activeIndex: itemCount - 1, preventDefault: true };
  }
  if (key === 'Enter' || key === 'Tab') {
    return { command: 'activate', activeIndex: current, preventDefault: true };
  }
  return { command: 'none', activeIndex: current, preventDefault: false };
}
