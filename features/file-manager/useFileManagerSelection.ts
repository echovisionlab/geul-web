'use client';

import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import type { FileManagerFileView, FileManagerItemView } from './model';

type FileManagerRow = FileManagerItemView;

interface ContextMenuState {
  x: number;
  y: number;
  itemId?: string;
}

interface MarqueeState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startLocalX: number;
  startLocalY: number;
  additiveIds: string[];
}

interface Options {
  items: FileManagerRow[];
  selectedItemIds: string[];
  onSelectedItemIdsChange: (ids: string[]) => void;
  onOpenFolder: (folder: Extract<FileManagerRow, { kind: 'folder' }>) => void;
  onOpenFile: (file: FileManagerFileView) => void;
}

function intersects(a: DOMRect, b: { left: number; right: number; top: number; bottom: number }) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

const itemSelector = '[data-file-viewer-item], [data-datatable-desktop-row], [data-datatable-mobile-row]';

export function useFileManagerSelection({
  items,
  selectedItemIds,
  onSelectedItemIdsChange,
  onOpenFolder,
  onOpenFile,
}: Options) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const selectionAnchorRef = useRef<number | null>(null);
  const suppressSurfaceClickRef = useRef(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedItemIds.includes(item.id)),
    [items, selectedItemIds],
  );
  const onlyFilesSelected = selectedItems.length > 0 && selectedItems.every((item) => item.kind === 'file');
  const contextItem = contextMenu?.itemId ? (items.find((item) => item.id === contextMenu.itemId) ?? null) : null;

  const releaseSurfaceFocus = () => {
    const surface = surfaceRef.current;
    const activeElement = surface?.ownerDocument.activeElement as HTMLElement | null;
    if (surface && activeElement && surface.contains(activeElement)) {
      activeElement.blur();
    }
  };

  const selectItem = (event: MouseEvent<HTMLElement>, item: FileManagerRow, index: number) => {
    const additive = event.metaKey || event.ctrlKey;
    if (event.shiftKey && selectionAnchorRef.current != null) {
      const start = Math.min(selectionAnchorRef.current, index);
      const end = Math.max(selectionAnchorRef.current, index);
      const rangeIds = items.slice(start, end + 1).map((candidate) => candidate.id);
      onSelectedItemIdsChange(additive ? [...new Set([...selectedItemIds, ...rangeIds])] : rangeIds);
      return;
    }
    if (additive) {
      onSelectedItemIdsChange(
        selectedItemIds.includes(item.id)
          ? selectedItemIds.filter((id) => id !== item.id)
          : [...selectedItemIds, item.id],
      );
    } else {
      onSelectedItemIdsChange([item.id]);
    }
    selectionAnchorRef.current = index;
  };

  const openItemContextMenuAt = (item: FileManagerRow, index: number, x: number, y: number) => {
    if (!selectedItemIds.includes(item.id)) {
      onSelectedItemIdsChange([item.id]);
    }
    selectionAnchorRef.current = index;
    setContextMenu({ x, y, itemId: item.id });
  };

  const openItemContextMenu = (event: MouseEvent<HTMLElement>, item: FileManagerRow, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    openItemContextMenuAt(item, index, event.clientX, event.clientY);
  };

  const activateItem = (item: FileManagerRow) => (item.kind === 'folder' ? onOpenFolder(item) : onOpenFile(item));

  const handleItemKeyDown = (event: KeyboardEvent<HTMLElement>, item: FileManagerRow, index: number) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      activateItem(item);
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      if (item.kind === 'file') {
        onOpenFile(item);
      } else {
        onSelectedItemIdsChange([item.id]);
        selectionAnchorRef.current = index;
      }
      return;
    }
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      openItemContextMenuAt(item, index, bounds.left + 20, bounds.top + 20);
    }
  };

  const openSurfaceContextMenu = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest(itemSelector)) {
      return;
    }
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  };

  const startMarquee = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest(itemSelector)) {
      return;
    }
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }
    const bounds = surface.getBoundingClientRect();
    releaseSurfaceFocus();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    suppressSurfaceClickRef.current = false;
    setContextMenu(null);
    setMarquee({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLocalX: event.clientX - bounds.left,
      startLocalY: event.clientY - bounds.top,
      additiveIds: event.metaKey || event.ctrlKey ? selectedItemIds : [],
    });
    setMarqueeRect({ left: event.clientX - bounds.left, top: event.clientY - bounds.top, width: 0, height: 0 });
    if (!event.metaKey && !event.ctrlKey) {
      onSelectedItemIdsChange([]);
    }
  };

  const updateMarquee = (event: PointerEvent<HTMLDivElement>) => {
    const surface = surfaceRef.current;
    if (!marquee || !surface || event.pointerId !== marquee.pointerId) {
      return;
    }
    const bounds = surface.getBoundingClientRect();
    const currentLocalX = event.clientX - bounds.left;
    const currentLocalY = event.clientY - bounds.top;
    const nextRect = {
      left: Math.min(marquee.startLocalX, currentLocalX),
      top: Math.min(marquee.startLocalY, currentLocalY),
      width: Math.abs(currentLocalX - marquee.startLocalX),
      height: Math.abs(currentLocalY - marquee.startLocalY),
    };
    if (nextRect.width > 3 || nextRect.height > 3) {
      suppressSurfaceClickRef.current = true;
    }
    setMarqueeRect(nextRect);

    const clientRect = {
      left: Math.min(marquee.startClientX, event.clientX),
      right: Math.max(marquee.startClientX, event.clientX),
      top: Math.min(marquee.startClientY, event.clientY),
      bottom: Math.max(marquee.startClientY, event.clientY),
    };
    const hitIds = Array.from(surface.querySelectorAll<HTMLElement>(itemSelector))
      .filter((node) => intersects(node.getBoundingClientRect(), clientRect))
      .map((node) => node.dataset.fileViewerItem ?? node.dataset.datatableDesktopRow ?? node.dataset.datatableMobileRow)
      .filter((id): id is string => Boolean(id));
    onSelectedItemIdsChange([...new Set([...marquee.additiveIds, ...hitIds])]);
  };

  const finishMarquee = (event: PointerEvent<HTMLDivElement>) => {
    if (!marquee || event.pointerId !== marquee.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setMarquee(null);
    setMarqueeRect(null);
    window.setTimeout(() => {
      suppressSurfaceClickRef.current = false;
    }, 0);
  };

  const clearSurfaceSelection = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(itemSelector)) {
      return;
    }
    releaseSurfaceFocus();
    if (suppressSurfaceClickRef.current) {
      suppressSurfaceClickRef.current = false;
      return;
    }
    onSelectedItemIdsChange([]);
    selectionAnchorRef.current = null;
  };

  const openContextItem = () => {
    if (contextItem) {
      activateItem(contextItem);
      setContextMenu(null);
    }
  };

  const changeTableSelection = (ids: string[]) => {
    onSelectedItemIdsChange(ids);
    selectionAnchorRef.current = ids.length ? items.findIndex((item) => item.id === ids.at(-1)) : null;
  };

  return {
    surfaceRef,
    contextMenu,
    setContextMenu,
    contextItem,
    selectedItems,
    onlyFilesSelected,
    marqueeRect,
    selectItem,
    activateItem,
    openItemContextMenu,
    handleItemKeyDown,
    openSurfaceContextMenu,
    startMarquee,
    updateMarquee,
    finishMarquee,
    clearSurfaceSelection,
    openContextItem,
    changeTableSelection,
  };
}
