import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { Plugin, type Transaction } from '@tiptap/pm/state';
import { columnResizingPluginKey, pointsAtCell, TableMap } from '@tiptap/pm/tables';
import { DecorationSet, type EditorView } from '@tiptap/pm/view';

import { TABLE_MIN_COLUMN_WIDTH_PX, TABLE_RESIZE_HANDLE_WIDTH_PX } from './table-constants';

const PERCENT_PRECISION = 10_000;

type ResizePluginState = {
  readonly activeHandle: number;
  readonly boundary: ResizeBoundary;
  readonly dragging: boolean;
};

type ResizeBoundary = 'internal' | 'outer-left' | 'outer-right' | null;

type ResizeTarget = {
  readonly cellPosition: number;
  readonly boundary: Exclude<ResizeBoundary, null>;
  readonly column?: number;
  readonly tableElement: HTMLTableElement;
};

type ResizeSession = {
  readonly column: number;
  readonly boundary: Exclude<ResizeBoundary, null>;
  readonly table: ProseMirrorNode;
  readonly tableStart: number;
  readonly tableElement: HTMLTableElement;
  readonly colgroup: HTMLTableColElement[];
  readonly hitZones: HTMLElement[];
  readonly guide: HTMLDivElement;
  readonly basePixels: number[];
  readonly baseContainerWidth: number;
  readonly baseContainerScrollWidth: number;
  readonly baseTableWidthPercent: number;
  readonly pointerId?: number;
  readonly captureTarget?: HTMLElement;
  currentWidths: number[];
  currentTableWidthPercent: number;
  readonly startX: number;
  readonly cleanup: () => void;
};

const sessions = new WeakMap<EditorView, ResizeSession>();
const clearResizeState = { setHandle: -1, setBoundary: null, setDragging: false } as const;

export function hasTableResizeSession(view: EditorView): boolean {
  return sessions.has(view);
}

function rounded(value: number): number {
  return Math.round(value * PERCENT_PRECISION) / PERCENT_PRECISION;
}

export function normalizeTableColumnWidths(widths: readonly number[]): number[] {
  const finite = widths.map((width) => (Number.isFinite(width) && width > 0 ? width : 0));
  const total = finite.reduce((sum, width) => sum + width, 0);
  if (total <= 0) {
    return equalTableColumnWidths(widths.length);
  }

  const normalized = finite.map((width) => rounded((width / total) * 100));
  if (normalized.length > 0) {
    const preceding = normalized.slice(0, -1).reduce((sum, width) => sum + width, 0);
    normalized[normalized.length - 1] = rounded(100 - preceding);
  }
  return normalized;
}

export function equalTableColumnWidths(count: number): number[] {
  if (!Number.isSafeInteger(count) || count <= 0) {
    return [];
  }
  return normalizeTableColumnWidths(new Array<number>(count).fill(1));
}

function rowColumnWidths(row: ProseMirrorNode, expectedColumns: number): number[] | null {
  const widths: number[] = [];
  for (let cellIndex = 0; cellIndex < row.childCount; cellIndex += 1) {
    const cell = row.child(cellIndex);
    const colspan = Number(cell.attrs.colspan) || 1;
    const colwidth = cell.attrs.colwidth;
    if (!Array.isArray(colwidth) || colwidth.length !== colspan) {
      return null;
    }
    for (const width of colwidth) {
      if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) {
        return null;
      }
      widths.push(width);
    }
  }
  return widths.length === expectedColumns ? widths : null;
}

export function readTableColumnWidths(table: ProseMirrorNode): number[] {
  const map = TableMap.get(table);
  const row = table.firstChild;
  const stored = row ? rowColumnWidths(row, map.width) : null;
  return normalizeTableColumnWidths(stored ?? equalTableColumnWidths(map.width));
}

function sameWidths(left: unknown, right: readonly number[]): boolean {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((width, index) => typeof width === 'number' && Math.abs(width - right[index]!) < 0.0001)
  );
}

function writeColumnWidths(
  transaction: Transaction,
  table: ProseMirrorNode,
  tableStart: number,
  widths: readonly number[],
): boolean {
  const map = TableMap.get(table);
  const seen = new Set<number>();
  let changed = false;

  for (const cellOffset of map.map) {
    if (seen.has(cellOffset)) {
      continue;
    }
    seen.add(cellOffset);
    const cell = table.nodeAt(cellOffset);
    if (!cell) {
      continue;
    }
    const column = map.colCount(cellOffset);
    const colspan = Number(cell.attrs.colspan) || 1;
    const next = widths.slice(column, column + colspan);
    if (sameWidths(cell.attrs.colwidth, next)) {
      continue;
    }
    transaction.setNodeMarkup(tableStart + cellOffset, undefined, {
      ...cell.attrs,
      colwidth: next,
    });
    changed = true;
  }
  return changed;
}

export function applyTableColumnWidths(
  table: ProseMirrorNode,
  colgroup: HTMLTableColElement,
  tableElement: HTMLTableElement,
): void {
  const widths = readTableColumnWidths(table);
  let column = colgroup.firstElementChild as HTMLTableColElement | null;
  for (const width of widths) {
    if (!column) {
      column = document.createElement('col');
      colgroup.append(column);
    }
    column.style.width = `${width}%`;
    column = column.nextElementSibling as HTMLTableColElement | null;
  }
  while (column) {
    const next = column.nextElementSibling as HTMLTableColElement | null;
    column.remove();
    column = next;
  }
  tableElement.style.width = '100%';
  applyTableLayout(table, tableElement);
  tableElement.style.minWidth = `${widths.length * TABLE_MIN_COLUMN_WIDTH_PX}px`;
}

function normalizedTableWidth(value: unknown): number {
  const width = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(width) ? Math.max(10, Math.min(100, width)) : 100;
}

function tableAlignment(table: ProseMirrorNode): 'left' | 'center' | 'right' {
  return table.attrs.textAlignment === 'center' || table.attrs.textAlignment === 'right'
    ? table.attrs.textAlignment
    : 'left';
}

function applyTableLayout(table: ProseMirrorNode, tableElement: HTMLTableElement): void {
  const width = normalizedTableWidth(table.attrs.previewWidth);
  const alignment = tableAlignment(table);
  tableElement.style.width = `${width}%`;
  tableElement.style.marginInlineStart = alignment === 'left' ? '0px' : 'auto';
  tableElement.style.marginInlineEnd = alignment === 'right' ? '0px' : 'auto';
  tableElement.dataset.textAlignment = alignment;
}

function tableElementAround(target: EventTarget | null): HTMLTableElement | null {
  return target instanceof Element ? target.closest('table') : null;
}

function cellElementAround(target: EventTarget | null): HTMLTableCellElement | null {
  return target instanceof Element ? target.closest('td, th') : null;
}

function edgeCellElement(view: EditorView, event: MouseEvent): HTMLTableCellElement | null {
  const direct = cellElementAround(event.target);
  if (direct) {
    const rect = direct.getBoundingClientRect();
    if (
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom &&
      Math.min(Math.abs(event.clientX - rect.left), Math.abs(event.clientX - rect.right)) <=
        TABLE_RESIZE_HANDLE_WIDTH_PX
    ) {
      return direct;
    }
  }

  const directTable = tableElementAround(event.target);
  const tables = directTable
    ? [directTable]
    : Array.from(view.dom.querySelectorAll<HTMLTableElement>('table')).filter((table) => {
        const rect = table.getBoundingClientRect();
        return (
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom &&
          event.clientX >= rect.left - TABLE_RESIZE_HANDLE_WIDTH_PX &&
          event.clientX <= rect.right + TABLE_RESIZE_HANDLE_WIDTH_PX
        );
      });
  let nearest: { cell: HTMLTableCellElement; distance: number } | null = null;
  for (const table of tables) {
    for (const cell of table.querySelectorAll<HTMLTableCellElement>('td, th')) {
      const rect = cell.getBoundingClientRect();
      if (event.clientY < rect.top || event.clientY > rect.bottom) {
        continue;
      }
      const distance = Math.min(Math.abs(event.clientX - rect.left), Math.abs(event.clientX - rect.right));
      if (distance <= TABLE_RESIZE_HANDLE_WIDTH_PX && (!nearest || distance < nearest.distance)) {
        nearest = { cell, distance };
      }
    }
  }
  return nearest?.cell ?? null;
}

function edgeTarget(view: EditorView, event: MouseEvent): ResizeTarget | null {
  const zone = event.target instanceof Element ? event.target.closest<HTMLElement>('.column-resize-hit-zone') : null;
  if (zone) {
    const boundary = zone.dataset.resizeBoundary;
    const cellPosition = Number(zone.dataset.cellPosition);
    const column = Number(zone.dataset.resizeColumn);
    const tableElement = zone.parentElement?.parentElement?.querySelector<HTMLTableElement>('table');
    if (
      tableElement &&
      Number.isSafeInteger(cellPosition) &&
      (boundary === 'internal' || boundary === 'outer-left' || boundary === 'outer-right')
    ) {
      return {
        cellPosition,
        boundary,
        ...(Number.isSafeInteger(column) ? { column } : {}),
        tableElement,
      };
    }
  }
  const target = edgeCellElement(view, event);
  if (!target) {
    return null;
  }
  const rect = target.getBoundingClientRect();
  const side =
    event.clientX - rect.left <= TABLE_RESIZE_HANDLE_WIDTH_PX
      ? 'left'
      : rect.right - event.clientX <= TABLE_RESIZE_HANDLE_WIDTH_PX
        ? 'right'
        : null;
  if (!side) {
    return null;
  }

  let resolved: ResolvedPos;
  try {
    resolved = view.state.doc.resolve(view.posAtDOM(target, 0));
  } catch {
    return null;
  }
  let cellDepth = -1;
  for (let depth = resolved.depth; depth > 0; depth -= 1) {
    const role = resolved.node(depth).type.spec.tableRole;
    if (role === 'cell' || role === 'header_cell') {
      cellDepth = depth;
      break;
    }
  }
  if (cellDepth < 2) {
    return null;
  }

  const tableDepth = cellDepth - 2;
  const table = resolved.node(tableDepth);
  const tableElement = target.closest('table');
  if (!tableElement) {
    return null;
  }
  const map = TableMap.get(table);
  const tableStart = resolved.start(tableDepth);
  const cellPosition = resolved.before(cellDepth);
  const index = map.map.indexOf(cellPosition - tableStart);
  if (index < 0) {
    return null;
  }
  const column = index % map.width;
  const alignment = tableAlignment(table);
  if (side === 'left') {
    if (column === 0) {
      return alignment === 'right' || alignment === 'center'
        ? { cellPosition, boundary: 'outer-left', tableElement }
        : null;
    }
    return { cellPosition: tableStart + map.map[index - 1]!, boundary: 'internal', tableElement };
  }
  const colspan = Number(resolved.node(cellDepth).attrs.colspan) || 1;
  if (column + colspan >= map.width) {
    return alignment === 'left' || alignment === 'center'
      ? { cellPosition, boundary: 'outer-right', tableElement }
      : null;
  }
  return { cellPosition, boundary: 'internal', tableElement };
}

function currentTableElement(view: EditorView, target: ResizeTarget): HTMLTableElement | null {
  const currentZone = Array.from(view.dom.querySelectorAll<HTMLElement>('.column-resize-hit-zone')).find(
    (zone) =>
      zone.dataset.cellPosition === String(target.cellPosition) && zone.dataset.resizeBoundary === target.boundary,
  );
  return (
    currentZone?.parentElement?.parentElement?.querySelector<HTMLTableElement>('table') ??
    (target.tableElement.isConnected ? target.tableElement : null)
  );
}

function setPreviewWidths(session: ResizeSession, widths: readonly number[]): void {
  session.colgroup.forEach((column, index) => {
    column.style.width = `${widths[index] ?? 0}%`;
  });
  session.tableElement.style.width = `${session.baseTableWidthPercent}%`;
  session.tableElement.style.minWidth = `${widths.length * TABLE_MIN_COLUMN_WIDTH_PX}px`;
  positionResizeHitZones(session, widths, session.baseTableWidthPercent);
  positionResizeGuide(session, widths);
}

function positionResizeHitZones(session: ResizeSession, widths: readonly number[], tableWidthPercent: number): void {
  const alignment = tableAlignment(session.table);
  const offset =
    alignment === 'right' ? 100 - tableWidthPercent : alignment === 'center' ? (100 - tableWidthPercent) / 2 : 0;
  for (const zone of session.hitZones) {
    const boundary = zone.dataset.resizeBoundary;
    const column = Number(zone.dataset.resizeColumn);
    if (boundary === 'outer-left') {
      zone.style.left = `${offset}%`;
    } else if (boundary === 'outer-right') {
      zone.style.left = `calc(${offset + tableWidthPercent}% - 32px)`;
    } else if (boundary === 'internal' && Number.isSafeInteger(column)) {
      const cumulative = widths.slice(0, column + 1).reduce((sum, width) => sum + width, 0);
      zone.style.left = `calc(${offset + tableWidthPercent * (cumulative / 100)}% - 16px)`;
    }
  }
}

function positionResizeGuide(session: ResizeSession, widths: readonly number[]): void {
  const container = session.tableElement.parentElement;
  if (!container) {
    return;
  }
  const tableRect = session.tableElement.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const precedingWidth =
    session.boundary === 'outer-left'
      ? 0
      : session.boundary === 'outer-right'
        ? 100
        : widths.slice(0, session.column + 1).reduce((sum, width) => sum + width, 0);
  const boundaryX =
    tableRect.left - containerRect.left + container.scrollLeft + tableRect.width * (precedingWidth / 100);
  const boundedBoundaryX = Math.max(1, Math.min(session.baseContainerScrollWidth - 1, boundaryX));
  session.guide.style.left = `${boundedBoundaryX}px`;
  session.guide.style.top = `${tableRect.top - containerRect.top + container.scrollTop}px`;
  session.guide.style.height = `${tableRect.height}px`;
}

function setPreviewTableWidth(session: ResizeSession, width: number): void {
  session.currentTableWidthPercent = width;
  session.tableElement.style.width = `${width}%`;
  positionResizeHitZones(session, session.currentWidths, width);
  positionResizeGuide(session, session.currentWidths);
}

function resizedTableWidth(session: ResizeSession, clientX: number): number {
  const containerWidth = session.baseContainerWidth;
  if (containerWidth <= 0) {
    return session.currentTableWidthPercent;
  }
  const direction = session.boundary === 'outer-left' ? -1 : 1;
  const multiplier = tableAlignment(session.table) === 'center' ? 2 : 1;
  const deltaPercent = ((clientX - session.startX) / containerWidth) * 100 * direction * multiplier;
  const minimum = Math.min(100, ((session.currentWidths.length * TABLE_MIN_COLUMN_WIDTH_PX) / containerWidth) * 100);
  return rounded(Math.max(minimum, Math.min(100, session.baseTableWidthPercent + deltaPercent)));
}

function resizeWidths(session: ResizeSession, clientX: number): number[] {
  const left = session.column;
  const right = left + 1;
  const tableWidth = session.basePixels.reduce((sum, width) => sum + width, 0);
  if (tableWidth <= 0) {
    return session.currentWidths;
  }
  const minimum = Math.min(49, (TABLE_MIN_COLUMN_WIDTH_PX / tableWidth) * 100);
  const base = readTableColumnWidths(session.table);
  const delta = ((clientX - session.startX) / tableWidth) * 100;
  const bounded = Math.max(minimum - base[left]!, Math.min(base[right]! - minimum, delta));
  const next = [...base];
  next[left] = base[left]! + bounded;
  next[right] = base[right]! - bounded;
  return normalizeTableColumnWidths(next);
}

function closeSession(view: EditorView, commit: boolean): void {
  const session = sessions.get(view);
  if (!session) {
    return;
  }
  sessions.delete(view);
  session.cleanup();

  if (!commit || !view.editable) {
    applyTableColumnWidths(session.table, session.tableElement.querySelector('colgroup')!, session.tableElement);
    positionResizeHitZones(
      session,
      readTableColumnWidths(session.table),
      normalizedTableWidth(session.table.attrs.previewWidth),
    );
    view.dispatch(view.state.tr.setMeta(columnResizingPluginKey, clearResizeState));
    return;
  }

  const currentTable = view.state.doc.nodeAt(session.tableStart - 1);
  if (!currentTable || currentTable.type.spec.tableRole !== 'table') {
    view.dispatch(view.state.tr.setMeta(columnResizingPluginKey, clearResizeState));
    return;
  }
  const transaction = view.state.tr.setMeta(columnResizingPluginKey, clearResizeState);
  if (session.boundary === 'internal') {
    writeColumnWidths(transaction, currentTable, session.tableStart, session.currentWidths);
  } else if (normalizedTableWidth(currentTable.attrs.previewWidth) !== session.currentTableWidthPercent) {
    transaction.setNodeMarkup(session.tableStart - 1, undefined, {
      ...currentTable.attrs,
      previewWidth: session.currentTableWidthPercent,
    });
  }
  if (transaction.docChanged) {
    transaction.setMeta('addToHistory', true);
  }
  view.dispatch(transaction);
}

export function startTableResize(view: EditorView, event: MouseEvent | PointerEvent): boolean {
  if (!view.editable || event.button !== 0 || sessions.has(view)) {
    return false;
  }
  const target = edgeTarget(view, event);
  const pluginState = columnResizingPluginKey.getState(view.state) as ResizePluginState | undefined;
  if (!pluginState || !target || pluginState.dragging) {
    return false;
  }
  const $cell = view.state.doc.resolve(target.cellPosition);
  const table = $cell.node(-1);
  const map = TableMap.get(table);
  const tableStart = $cell.start(-1);
  const column =
    target.column ?? map.colCount($cell.pos - tableStart) + (Number($cell.nodeAfter?.attrs.colspan) || 1) - 1;
  if (column < 0 || (target.boundary === 'internal' && column >= map.width - 1)) {
    return false;
  }
  const tableElement = currentTableElement(view, target);
  if (!tableElement) {
    return false;
  }
  const container = tableElement.parentElement;
  if (!container) {
    return false;
  }
  const colgroup = Array.from(tableElement.querySelectorAll<HTMLTableColElement>('colgroup > col'));
  if (colgroup.length !== map.width) {
    return false;
  }
  const tableWidth = tableElement.getBoundingClientRect().width;
  const containerRect = container.getBoundingClientRect();
  if (containerRect.width <= 0) {
    return false;
  }
  const stored = readTableColumnWidths(table);
  const basePixels = colgroup.map((columnElement, index) => {
    const measured = columnElement.getBoundingClientRect().width;
    return measured > 0 ? measured : tableWidth * (stored[index]! / 100);
  });
  const ownerDocument = tableElement.ownerDocument;
  const win = ownerDocument.defaultView ?? window;
  const pointerId = 'pointerId' in event ? event.pointerId : undefined;
  const captureTarget = event.target instanceof HTMLElement ? event.target : undefined;
  const move = (moveEvent: MouseEvent | PointerEvent) => {
    const session = sessions.get(view);
    if (
      !session ||
      ('pointerId' in moveEvent && session.pointerId !== undefined && session.pointerId !== moveEvent.pointerId)
    ) {
      return;
    }
    if (session.boundary === 'internal') {
      session.currentWidths = resizeWidths(session, moveEvent.clientX);
      setPreviewWidths(session, session.currentWidths);
    } else {
      setPreviewTableWidth(session, resizedTableWidth(session, moveEvent.clientX));
    }
  };
  const up = (upEvent: MouseEvent | PointerEvent) => {
    const session = sessions.get(view);
    if (
      !session ||
      ('pointerId' in upEvent && session.pointerId !== undefined && session.pointerId !== upEvent.pointerId)
    ) {
      return;
    }
    closeSession(view, true);
  };
  const cancel = (cancelEvent?: PointerEvent) => {
    const session = sessions.get(view);
    if (!session || (cancelEvent && session.pointerId !== cancelEvent.pointerId)) {
      return;
    }
    closeSession(view, false);
  };
  const blur = () => closeSession(view, false);
  const cleanup = () => {
    ownerDocument.removeEventListener('mousemove', move);
    ownerDocument.removeEventListener('mouseup', up);
    win.removeEventListener('mousemove', move);
    win.removeEventListener('mouseup', up);
    if (pointerId !== undefined) {
      ownerDocument.removeEventListener('pointermove', move);
      ownerDocument.removeEventListener('pointerup', up);
      ownerDocument.removeEventListener('pointercancel', cancel);
      captureTarget?.removeEventListener('lostpointercapture', cancel);
      if (captureTarget?.hasPointerCapture?.(pointerId)) {
        captureTarget.releasePointerCapture(pointerId);
      }
    }
    win.removeEventListener('blur', blur);
    ownerDocument.documentElement.classList.remove('table-resizing');
    guide.remove();
  };
  const guide = ownerDocument.createElement('div');
  guide.className = 'column-resize-guide';
  guide.contentEditable = 'false';
  tableElement.parentElement?.append(guide);
  const session: ResizeSession = {
    column,
    boundary: target.boundary,
    table,
    tableStart,
    tableElement,
    colgroup,
    hitZones: Array.from(container.querySelectorAll<HTMLElement>('.column-resize-hit-zone')),
    guide,
    basePixels,
    baseContainerWidth: containerRect.width,
    baseContainerScrollWidth: Math.max(container.scrollWidth, containerRect.width),
    baseTableWidthPercent: normalizedTableWidth(table.attrs.previewWidth),
    ...(pointerId === undefined ? {} : { pointerId }),
    ...(captureTarget ? { captureTarget } : {}),
    currentWidths: stored,
    currentTableWidthPercent: normalizedTableWidth(table.attrs.previewWidth),
    startX: event.clientX,
    cleanup,
  };
  sessions.set(view, session);
  positionResizeGuide(session, stored);
  ownerDocument.documentElement.classList.add('table-resizing');
  ownerDocument.addEventListener('mousemove', move);
  ownerDocument.addEventListener('mouseup', up);
  win.addEventListener('mousemove', move);
  win.addEventListener('mouseup', up);
  if (pointerId !== undefined) {
    ownerDocument.addEventListener('pointermove', move);
    ownerDocument.addEventListener('pointerup', up);
    ownerDocument.addEventListener('pointercancel', cancel);
    captureTarget?.addEventListener('lostpointercapture', cancel);
    try {
      captureTarget?.setPointerCapture?.(pointerId);
    } catch {
      // Pointer capture can fail when the pointer was already released; the
      // document listeners remain authoritative for this drag.
    }
  }
  win.addEventListener('blur', blur);
  event.preventDefault();
  return true;
}

export function normalizeTableWidthsInTransaction(transaction: Transaction): boolean {
  let changed = false;
  transaction.doc.descendants((node, position) => {
    if (node.type.spec.tableRole !== 'table') {
      return true;
    }
    const widths = readTableColumnWidths(node);
    changed = writeColumnWidths(transaction, node, position + 1, widths) || changed;
    return false;
  });
  return changed;
}

export function createPercentageColumnResizingPlugin(): Plugin<ResizePluginState> {
  return new Plugin<ResizePluginState>({
    key: columnResizingPluginKey,
    state: {
      init: () => ({ activeHandle: -1, boundary: null, dragging: false }),
      apply(transaction, previous) {
        const action = transaction.getMeta(columnResizingPluginKey) as
          { setHandle?: number; setBoundary?: ResizeBoundary; setDragging?: boolean } | undefined;
        if (action?.setHandle !== undefined) {
          return { activeHandle: action.setHandle, boundary: action.setBoundary ?? null, dragging: false };
        }
        if (action?.setDragging !== undefined) {
          return { activeHandle: previous.activeHandle, boundary: previous.boundary, dragging: action.setDragging };
        }
        if (previous.activeHandle >= 0 && transaction.docChanged) {
          const activeHandle = transaction.mapping.map(previous.activeHandle, -1);
          return {
            activeHandle: pointsAtCell(transaction.doc.resolve(activeHandle)) ? activeHandle : -1,
            boundary: previous.boundary,
            dragging: previous.dragging,
          };
        }
        return previous;
      },
    },
    props: {
      attributes(state): Record<string, string> {
        const pluginState = columnResizingPluginKey.getState(state) as ResizePluginState | undefined;
        return pluginState && pluginState.activeHandle >= 0 ? { class: 'resize-cursor' } : {};
      },
      handleDOMEvents: {
        mousedown: startTableResize,
      },
      decorations() {
        return DecorationSet.empty;
      },
    },
    view(view) {
      return {
        update(updatedView) {
          if (!updatedView.editable && sessions.has(updatedView)) {
            closeSession(updatedView, false);
          }
        },
        destroy() {
          closeSession(view, false);
        },
      };
    },
  });
}
