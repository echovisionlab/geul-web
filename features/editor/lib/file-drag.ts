'use client';

export { isFileDragTransfer } from '@/components/core/ImageUpload/file-drag';

const MEDIA_EMPTY_BLOCK_SELECTOR = '.attachment-block--empty';

export function isMediaPlaceholderDropTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(MEDIA_EMPTY_BLOCK_SELECTOR));
}

export function isMediaPlaceholderDropTargetAtPoint(clientX: number, clientY: number): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const target = document.elementFromPoint(clientX, clientY);
  return isMediaPlaceholderDropTarget(target);
}
