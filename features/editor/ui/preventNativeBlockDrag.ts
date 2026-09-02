import type { DragEvent } from 'react';

export function preventNativeBlockDrag(event: DragEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}
