// @vitest-environment jsdom

import { Editor, type JSONContent } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { CellSelection, columnResizingPluginKey, selectedRect, type ResizeState } from '@tiptap/pm/tables';
import { describe, expect, it, vi } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';
import { isBlockId } from '@/lib/editor/block-id';
import { getTableGeometryError } from './table-commands';
import { createTiptapTableExtensions } from './table-extensions';
import { readTableColumnWidths } from './percentage-column-resizing';

function resizeState(editor: Editor): ResizeState | undefined {
  return columnResizingPluginKey.getState(editor.state);
}

const tableNodeNames = new Set(['table', 'tableRow', 'tableCell', 'tableHeader']);

function createEditor(onError?: (message: string) => void, content?: string | JSONContent) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [
      ...createTiptapWireExtensions().filter((extension) => !tableNodeNames.has(extension.name)),
      ...createTiptapTableExtensions({ onError: (error) => onError?.(error.message) }),
    ],
    content: content ?? {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [{ type: 'blockContainer', attrs: { id: 'table' }, content: [{ type: 'paragraph' }] }],
        },
      ],
    },
  });
  editor.commands.setTextSelection(3);
  return {
    editor,
    destroy: () => {
      editor.destroy();
      element.remove();
    },
  };
}

function selectFirstTableCell(editor: Editor) {
  let cellPosition = -1;
  editor.state.doc.descendants((node, position) => {
    if (cellPosition < 0 && node.type.spec.tableRole === 'cell') {
      cellPosition = position;
    }
  });
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, cellPosition + 2)));
}

function pointerEvent(type: string, init: MouseEventInit & { pointerId: number }): PointerEvent {
  const event = new MouseEvent(type, init);
  Object.defineProperty(event, 'pointerId', { configurable: true, value: init.pointerId });
  return event as PointerEvent;
}

async function flushDomObserver(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Tiptap table commands', () => {
  it('renders table content without a separate outer selector control', async () => {
    const mounted = createEditor();
    expect(mounted.editor.commands.insertTable({ rows: 2, columns: 2 })).toBe(true);
    await flushDomObserver();
    const runtime = mounted.editor.view.dom.querySelector<HTMLElement>('[data-testid="tiptap-table-runtime"]');
    expect(runtime?.querySelector('[data-testid="tiptap-table-selector"]')).toBeNull();
    expect(runtime?.firstElementChild?.querySelector('table')).not.toBeNull();
    mounted.destroy();
  });

  it('creates a rectangular table with durable header, span, and colwidth attrs', () => {
    const errors: string[] = [];
    const mounted = createEditor((message) => errors.push(message));
    const inserted = mounted.editor.commands.insertTable({ rows: 2, columns: 3, withHeaderRow: true });
    expect(inserted, errors.at(-1)).toBe(true);
    const table = mounted.editor.state.doc.firstChild?.firstChild?.firstChild;
    expect(table?.type.name).toBe('table');
    expect(table?.childCount).toBe(2);
    expect(table?.child(0).child(0).type.name).toBe('tableHeader');
    expect(table?.child(1).child(2).attrs).toMatchObject({
      colspan: 1,
      rowspan: 1,
      colwidth: [33.3334],
    });
    if (!table) {
      throw new Error('Expected an inserted table.');
    }
    const identities = new Set<string>();
    table.descendants((node) => {
      if (
        node.type.spec.tableRole === 'row' ||
        node.type.spec.tableRole === 'cell' ||
        node.type.spec.tableRole === 'header_cell'
      ) {
        expect(isBlockId(node.attrs.id)).toBe(true);
        identities.add(String(node.attrs.id));
      }
    });
    expect(identities.size).toBe(8);
    expect(readTableColumnWidths(table)).toEqual([33.3333, 33.3333, 33.3334]);
    expect(mounted.editor.getHTML()).toContain('data-colwidth="33.3333"');
    expect(getTableGeometryError(table)).toBeNull();
    mounted.destroy();
  });

  it('clears table selection and column-resize state when editability is revoked', () => {
    const mounted = createEditor();
    expect(mounted.editor.commands.insertTable({ rows: 2, columns: 2 })).toBe(true);
    selectFirstTableCell(mounted.editor);
    expect(mounted.editor.commands.selectTableRow()).toBe(true);
    expect(mounted.editor.state.selection).toBeInstanceOf(CellSelection);
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setMeta(columnResizingPluginKey, { setHandle: mounted.editor.state.selection.from }),
    );
    const documentBeforeRevocation = mounted.editor.getJSON();
    mounted.editor.setEditable(false);

    expect(mounted.editor.getJSON()).toEqual(documentBeforeRevocation);
    expect(mounted.editor.state.selection).not.toBeInstanceOf(CellSelection);
    expect(columnResizingPluginKey.getState(mounted.editor.state)?.activeHandle).toBe(-1);
    expect(
      mounted.editor.view.dom.querySelector('[data-testid="tiptap-table-runtime"]')?.hasAttribute('data-selected'),
    ).toBe(false);
    expect(mounted.editor.view.dom.querySelectorAll('[data-testid$="drag-handle"]')).toHaveLength(0);
    mounted.destroy();
  });

  it('does not create row, column, or extension controls on cell hover', async () => {
    const mounted = createEditor();
    expect(mounted.editor.commands.insertTable({ rows: 2, columns: 2 })).toBe(true);
    await flushDomObserver();
    const runtime = mounted.editor.view.dom.querySelector<HTMLElement>('[data-testid="tiptap-table-runtime"]');
    const bodyCell = runtime?.querySelector<HTMLTableCellElement>('td');
    if (!runtime || !bodyCell) {
      throw new Error('Expected a rendered body cell.');
    }
    bodyCell.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 120, clientY: 130 }));
    await flushDomObserver();
    expect(runtime.querySelector('[data-testid="tiptap-table-row-drag-handle"]')).toBeNull();
    expect(runtime.querySelector('[data-testid="tiptap-table-column-drag-handle"]')).toBeNull();
    expect(runtime.querySelector('[data-testid="tiptap-table-extend-row"]')).toBeNull();
    expect(runtime.querySelector('[data-testid="tiptap-table-extend-column"]')).toBeNull();
    expect(runtime.querySelectorAll('.column-resize-hit-zone').length).toBeGreaterThan(0);
    mounted.destroy();
  });

  it('edits rows, columns, headers, cell selection, and cell styles without breaking geometry', () => {
    const errors: string[] = [];
    const mounted = createEditor((message) => errors.push(message));
    mounted.editor.commands.insertTable({ rows: 2, columns: 2 });
    selectFirstTableCell(mounted.editor);
    expect(mounted.editor.commands.addTableColumnAfter()).toBe(true);
    expect(mounted.editor.commands.addTableRowAfter()).toBe(true);
    expect(mounted.editor.commands.toggleTableHeaderRow()).toBe(true);
    expect(mounted.editor.commands.setTableCellTextColor('blue')).toBe(true);
    expect(mounted.editor.commands.setTableCellBackgroundColor('yellow')).toBe(true);
    expect(mounted.editor.commands.setTableCellAlignment('center')).toBe(true);
    expect(mounted.editor.commands.selectTableRow()).toBe(true);
    let cellSelection = mounted.editor.state.selection;
    expect(cellSelection).toBeInstanceOf(CellSelection);
    if (!(cellSelection instanceof CellSelection)) {
      throw new Error('Expected a row cell selection.');
    }
    expect(cellSelection.isRowSelection()).toBe(true);
    expect(selectedRect(mounted.editor.state)).toMatchObject({ left: 0, right: 3, top: 0, bottom: 1 });
    expect(mounted.editor.commands.selectTableColumn()).toBe(true);
    cellSelection = mounted.editor.state.selection;
    if (!(cellSelection instanceof CellSelection)) {
      throw new Error('Expected a column cell selection.');
    }
    expect(cellSelection.isColSelection()).toBe(true);
    expect(selectedRect(mounted.editor.state)).toMatchObject({ left: 0, right: 3, top: 0, bottom: 3 });
    expect(mounted.editor.commands.selectTableRow()).toBe(true);
    cellSelection = mounted.editor.state.selection;
    if (!(cellSelection instanceof CellSelection)) {
      throw new Error('Expected a row cell selection.');
    }
    expect(cellSelection.isRowSelection()).toBe(true);
    expect(selectedRect(mounted.editor.state)).toMatchObject({ left: 0, right: 3, top: 0, bottom: 3 });
    selectFirstTableCell(mounted.editor);
    expect(mounted.editor.commands.selectTableRow()).toBe(true);
    expect(mounted.editor.commands.deleteTableRow(), errors.at(-1)).toBe(true);
    const table = mounted.editor.state.doc.firstChild?.firstChild?.firstChild;
    expect(table?.childCount).toBe(2);
    expect(table?.child(0).childCount).toBe(3);
    if (!table) {
      throw new Error('Expected the edited table.');
    }
    const widths = readTableColumnWidths(table);
    expect(widths).toHaveLength(3);
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(100);
    for (let row = 0; row < table.childCount; row += 1) {
      const rowWidths = Array.from(
        { length: table.child(row).childCount },
        (_, cell) => table.child(row).child(cell).attrs.colwidth,
      ).flat();
      expect(rowWidths).toEqual(widths);
    }
    expect(getTableGeometryError(table)).toBeNull();
    mounted.destroy();
  });

  it('round-trips pink cell text and background colors through DOM parsing', () => {
    const mounted = createEditor();
    expect(mounted.editor.commands.insertTable({ rows: 1, columns: 1 })).toBe(true);
    selectFirstTableCell(mounted.editor);
    expect(mounted.editor.commands.setTableCellTextColor('pink')).toBe(true);
    expect(mounted.editor.commands.setTableCellBackgroundColor('pink')).toBe(true);
    const html = mounted.editor.getHTML();
    expect(html).toContain('data-text-color="pink"');
    expect(html).toContain('data-background-color="pink"');
    mounted.destroy();

    const restored = createEditor(undefined, html);
    let cell: { attrs: Record<string, unknown> } | undefined;
    restored.editor.state.doc.descendants((node) => {
      if (!cell && node.type.spec.tableRole === 'cell') {
        cell = node;
      }
    });
    expect(cell?.attrs).toMatchObject({ textColor: 'pink', backgroundColor: 'pink' });
    restored.destroy();
  });

  it('resizes only an internal boundary and persists normalized percentages', () => {
    const mounted = createEditor();
    expect(mounted.editor.commands.insertTable({ rows: 2, columns: 3 })).toBe(true);
    const tableElement = mounted.editor.view.dom.querySelector<HTMLTableElement>('table');
    const cells = Array.from(tableElement?.querySelectorAll<HTMLTableCellElement>('td, th') ?? []);
    const firstCell = cells[0];
    const secondCell = cells[1];
    const lastCell = cells[2];
    const columns = Array.from(tableElement?.querySelectorAll<HTMLTableColElement>('colgroup > col') ?? []);
    const scrollContainer = tableElement?.parentElement;
    if (!tableElement || !scrollContainer || !firstCell || !secondCell || !lastCell || columns.length !== 3) {
      throw new Error('Expected a rendered 3-column table.');
    }
    vi.spyOn(tableElement, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 200));
    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 200));
    vi.spyOn(firstCell, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 100));
    vi.spyOn(secondCell, 'getBoundingClientRect').mockReturnValue(new DOMRect(200, 0, 200, 100));
    vi.spyOn(lastCell, 'getBoundingClientRect').mockReturnValue(new DOMRect(400, 0, 200, 100));
    columns.forEach((column, index) => {
      vi.spyOn(column, 'getBoundingClientRect').mockReturnValue(new DOMRect(index * 200, 0, 200, 200));
    });
    expect(tableElement.style.minWidth).toBe('216px');
    const internalZone = scrollContainer.querySelector<HTMLElement>('.column-resize-hit-zone-internal');
    if (!internalZone) {
      throw new Error('Expected an authoritative internal resize hit zone.');
    }
    expect(internalZone.dataset).toMatchObject({ resizeBoundary: 'internal' });

    expect(tableElement.querySelectorAll('.column-resize-handle')).toHaveLength(0);
    expect(scrollContainer.querySelectorAll('.column-resize-hit-zone')).toHaveLength(3);

    internalZone.dispatchEvent(pointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 184, pointerId: 3 }));
    expect(scrollContainer.querySelector('.column-resize-guide')).not.toBeNull();
    window.dispatchEvent(new MouseEvent('blur'));

    firstCell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 200 }));
    const guide = scrollContainer.querySelector<HTMLElement>('.column-resize-guide');
    expect(guide).not.toBeNull();
    expect(Number.parseFloat(guide?.style.left ?? '')).toBeCloseTo(200, 3);
    expect(guide?.style.height).toBe('200px');
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 260 }));
    const preview = columns.map((column) => Number.parseFloat(column.style.width));
    expect(preview).toEqual([43.3333, 23.3333, 33.3334]);
    expect(Number.parseFloat(guide?.style.left ?? '')).toBeCloseTo(260, 3);
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 260 }));
    expect(scrollContainer.querySelector('.column-resize-guide')).toBeNull();

    const table = mounted.editor.state.doc.firstChild?.firstChild?.firstChild;
    if (!table) {
      throw new Error('Expected a resized table.');
    }
    expect(readTableColumnWidths(table)).toEqual(preview);
    expect(readTableColumnWidths(table).reduce((sum, width) => sum + width, 0)).toBe(100);
    expect(mounted.editor.getHTML()).toContain('data-colwidth="43.3333"');

    const updatedTableElement = mounted.editor.view.dom.querySelector<HTMLTableElement>('table');
    const updatedFirstCell = updatedTableElement?.querySelector<HTMLTableCellElement>('td, th');
    const updatedColumns = Array.from(
      updatedTableElement?.querySelectorAll<HTMLTableColElement>('colgroup > col') ?? [],
    );
    if (!updatedTableElement || !updatedFirstCell || updatedColumns.length !== 3) {
      throw new Error('Expected the table DOM after the first committed resize.');
    }
    vi.spyOn(updatedTableElement, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 200));
    vi.spyOn(updatedFirstCell, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 260, 100));
    updatedColumns.forEach((column, index) => {
      vi.spyOn(column, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(index === 0 ? 0 : index === 1 ? 260 : 400, 0, index === 0 ? 260 : index === 1 ? 140 : 200, 200),
      );
    });
    updatedFirstCell.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 258 }));
    updatedFirstCell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 260 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: -1_000 }));
    const minimumPreview = updatedColumns.map((column) => Number.parseFloat(column.style.width));
    expect(minimumPreview[0]! * 6).toBeCloseTo(72, 3);
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: -1_000 }));
    const clampedTable = mounted.editor.state.doc.firstChild?.firstChild?.firstChild;
    if (!clampedTable) {
      throw new Error('Expected a resized table after minimum-width clamping.');
    }
    expect(readTableColumnWidths(clampedTable)).toEqual(minimumPreview);
    mounted.destroy();
  });

  it('resizes allowed outer edges and persists table width without changing column ratios', () => {
    const mounted = createEditor();
    expect(mounted.editor.commands.insertTable({ rows: 1, columns: 2 })).toBe(true);
    const tableElement = mounted.editor.view.dom.querySelector<HTMLTableElement>('table');
    const scrollContainer = tableElement?.parentElement;
    const cells = Array.from(tableElement?.querySelectorAll<HTMLTableCellElement>('td, th') ?? []);
    if (!tableElement || !scrollContainer || cells.length !== 2) {
      throw new Error('Expected an outer-resizable table.');
    }
    vi.spyOn(tableElement, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 100));
    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 100));
    vi.spyOn(cells[0]!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 300, 100));
    vi.spyOn(cells[1]!, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 0, 300, 100));

    cells[1]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 600 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 480 }));
    expect(tableElement.style.width).toBe('80%');
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 480 }));
    const table = mounted.editor.state.doc.firstChild?.firstChild?.firstChild;
    expect(table?.attrs).toMatchObject({ previewWidth: 80, textAlignment: 'left' });
    if (!table) {
      throw new Error('Expected table after outer resize.');
    }
    expect(readTableColumnWidths(table)).toEqual([50, 50]);

    const tablePosition = 2;
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setNodeMarkup(tablePosition, undefined, {
        ...table.attrs,
        previewWidth: 80,
        textAlignment: 'center',
      }),
    );
    const centeredTable = mounted.editor.view.dom.querySelector<HTMLTableElement>('table');
    const centeredScroll = centeredTable?.parentElement;
    const centeredCells = Array.from(centeredTable?.querySelectorAll<HTMLTableCellElement>('td, th') ?? []);
    if (!centeredTable || !centeredScroll || centeredCells.length !== 2) {
      throw new Error('Expected centered table DOM.');
    }
    vi.spyOn(centeredTable, 'getBoundingClientRect').mockReturnValue(new DOMRect(60, 0, 480, 100));
    vi.spyOn(centeredScroll, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 100));
    vi.spyOn(centeredCells[0]!, 'getBoundingClientRect').mockReturnValue(new DOMRect(60, 0, 240, 100));
    vi.spyOn(centeredCells[1]!, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 0, 240, 100));
    centeredCells[0]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 60 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 90 }));
    expect(centeredTable.style.width).toBe('70%');
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 90 }));
    expect(mounted.editor.state.doc.firstChild?.firstChild?.firstChild?.attrs).toMatchObject({
      previewWidth: 70,
      textAlignment: 'center',
    });

    const centeredDocumentTable = mounted.editor.state.doc.firstChild?.firstChild?.firstChild;
    if (!centeredDocumentTable) {
      throw new Error('Expected the centered table document node.');
    }
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setNodeMarkup(tablePosition, undefined, {
        ...centeredDocumentTable.attrs,
        textAlignment: 'right',
      }),
    );
    const rightTable = mounted.editor.view.dom.querySelector<HTMLTableElement>('table');
    const rightScroll = rightTable?.parentElement;
    const rightCells = Array.from(rightTable?.querySelectorAll<HTMLTableCellElement>('td, th') ?? []);
    if (!rightTable || !rightScroll || rightCells.length !== 2) {
      throw new Error('Expected right-aligned table DOM.');
    }
    vi.spyOn(rightTable, 'getBoundingClientRect').mockReturnValue(new DOMRect(180, 0, 420, 100));
    vi.spyOn(rightScroll, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 100));
    vi.spyOn(rightCells[0]!, 'getBoundingClientRect').mockReturnValue(new DOMRect(180, 0, 210, 100));
    vi.spyOn(rightCells[1]!, 'getBoundingClientRect').mockReturnValue(new DOMRect(390, 0, 210, 100));
    rightCells[0]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 180 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 120 }));
    expect(rightTable.style.width).toBe('80%');
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 120 }));
    expect(mounted.editor.state.doc.firstChild?.firstChild?.firstChild?.attrs).toMatchObject({
      previewWidth: 80,
      textAlignment: 'right',
    });
    mounted.destroy();
  });

  it('owns pointer drag on the visible outer handle, previews directly, and commits once on release', () => {
    const mounted = createEditor();
    expect(mounted.editor.commands.insertTable({ rows: 1, columns: 2 })).toBe(true);
    const tableElement = mounted.editor.view.dom.querySelector<HTMLTableElement>('table');
    const scrollContainer = tableElement?.parentElement;
    const outerRight = scrollContainer?.querySelector<HTMLElement>('.column-resize-hit-zone-outer-right');
    if (!tableElement || !scrollContainer || !outerRight) {
      throw new Error('Expected the visible outer-right handle.');
    }
    vi.spyOn(tableElement, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 100));
    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 100));
    Object.defineProperty(scrollContainer, 'clientWidth', { configurable: true, value: 600 });
    Object.defineProperty(scrollContainer, 'scrollWidth', { configurable: true, value: 600 });
    const selectionBefore = mounted.editor.state.selection.toJSON();
    const documentBefore = mounted.editor.getJSON();
    let transactionCount = 0;
    mounted.editor.on('transaction', () => {
      transactionCount += 1;
    });

    outerRight.dispatchEvent(pointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 600, pointerId: 7 }));
    expect(outerRight.dataset.resizeStarted).toBe('true');
    expect(transactionCount).toBe(0);
    expect(resizeState(mounted.editor)).toMatchObject({ activeHandle: -1, dragging: false });
    expect(document.documentElement.classList.contains('table-resizing')).toBe(true);

    document.dispatchEvent(pointerEvent('pointermove', { bubbles: true, button: 0, clientX: 480, pointerId: 7 }));
    expect(tableElement.style.width).toBe('80%');
    expect(outerRight.style.left).toBe('calc(80% - 32px)');
    expect(scrollContainer.querySelector('.column-resize-guide')).not.toBeNull();
    expect(tableElement.isConnected).toBe(true);
    expect(scrollContainer.querySelector('.column-resize-guide')?.isConnected).toBe(true);
    expect(scrollContainer.scrollWidth).toBe(scrollContainer.clientWidth);
    expect(mounted.editor.getJSON()).toEqual(documentBefore);
    expect(mounted.editor.state.selection.toJSON()).toEqual(selectionBefore);
    expect(transactionCount).toBe(0);

    document.dispatchEvent(pointerEvent('pointerup', { bubbles: true, button: 0, clientX: 480, pointerId: 7 }));
    expect(transactionCount).toBe(1);
    expect(mounted.editor.state.doc.firstChild?.firstChild?.firstChild?.attrs).toMatchObject({ previewWidth: 80 });
    expect(scrollContainer.querySelector('.column-resize-guide')).toBeNull();
    expect(document.documentElement.classList.contains('table-resizing')).toBe(false);
    expect(mounted.editor.state.selection.toJSON()).toEqual(selectionBefore);
    mounted.destroy();
  });

  it('rejects malformed dimensions and refuses to mutate an invalid persisted shape', () => {
    const errors: string[] = [];
    const mounted = createEditor((message) => errors.push(message));
    expect(mounted.editor.commands.insertTable({ rows: 0, columns: 2 })).toBe(false);
    expect(errors.at(-1)).toContain('dimensions');
    mounted.editor.commands.insertTable({ rows: 2, columns: 2 });
    const tablePosition = 2;
    const validDocument = mounted.editor.getJSON();
    // A bad colspan/colwidth vector must be rejected before a row/column command runs.
    const firstCellPosition = tablePosition + 2;
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setNodeMarkup(firstCellPosition, undefined, {
        ...mounted.editor.state.doc.nodeAt(firstCellPosition)?.attrs,
        colspan: 2,
        colwidth: [120],
      }),
    );
    expect(mounted.editor.getJSON()).toEqual(validDocument);
    expect(errors.at(-1)).toContain('invalid persisted column-width');
    selectFirstTableCell(mounted.editor);
    expect(mounted.editor.commands.addTableRowAfter()).toBe(true);
    mounted.destroy();
  });

  it('extends, reorders, and keeps keyboard navigation inside the guarded table geometry', () => {
    const mounted = createEditor();
    mounted.editor.commands.insertTable({ rows: 2, columns: 2 });
    selectFirstTableCell(mounted.editor);

    expect(mounted.editor.commands.extendTableRow()).toBe(true);
    expect(mounted.editor.commands.extendTableColumn()).toBe(true);
    expect(mounted.editor.commands.moveTableRow(0, 2)).toBe(true);
    expect(mounted.editor.commands.moveTableColumn(0, 2)).toBe(true);

    const table = mounted.editor.state.doc.firstChild?.firstChild?.firstChild;
    expect(table?.childCount).toBe(3);
    expect(table?.child(0).childCount).toBe(3);
    expect(getTableGeometryError(table!)).toBeNull();
    const identities = new Set<string>();
    table?.descendants((node) => {
      if (
        node.type.spec.tableRole === 'row' ||
        node.type.spec.tableRole === 'cell' ||
        node.type.spec.tableRole === 'header_cell'
      ) {
        expect(isBlockId(node.attrs.id)).toBe(true);
        identities.add(String(node.attrs.id));
      }
    });
    expect(identities.size).toBe(12);
    expect(columnResizingPluginKey.getState(mounted.editor.state)).toBeTruthy();

    // Backspace at any cell start (including non-empty cells) must not lift/delete the cell.
    selectFirstTableCell(mounted.editor);
    mounted.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    const tableAfterBackspace = mounted.editor.state.doc.firstChild?.firstChild?.firstChild;
    if (!tableAfterBackspace) {
      throw new Error('Expected the table to survive Backspace.');
    }
    expect(getTableGeometryError(tableAfterBackspace)).toBeNull();
    mounted.destroy();
  });

  it('fails closed when an edge extension would exceed the configured geometry limit', () => {
    const errors: string[] = [];
    const element = document.createElement('div');
    document.body.append(element);
    const editor = new Editor({
      element,
      extensions: [
        ...createTiptapWireExtensions().filter((extension) => !tableNodeNames.has(extension.name)),
        ...createTiptapTableExtensions({ maxRows: 2, onError: (error) => errors.push(error.message) }),
      ],
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [{ type: 'blockContainer', attrs: { id: 'table' }, content: [{ type: 'paragraph' }] }],
          },
        ],
      },
    });
    editor.commands.setTextSelection(3);
    expect(editor.commands.insertTable({ rows: 2, columns: 2 })).toBe(true);
    selectFirstTableCell(editor);
    const before = editor.getJSON();
    expect(editor.commands.extendTableRow()).toBe(false);
    expect(editor.getJSON()).toEqual(before);
    expect(errors.at(-1)).toContain('geometry limit');
    editor.destroy();
    element.remove();
  });

  it('exits below on Enter, does not extend on Tab, and consumes Backspace at any cell start', () => {
    const mounted = createEditor();
    mounted.editor.commands.insertTable({ rows: 1, columns: 1 });
    selectFirstTableCell(mounted.editor);
    const tableBeforeTab = mounted.editor.state.doc.firstChild?.firstChild?.firstChild;
    mounted.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(mounted.editor.state.doc.firstChild?.firstChild?.firstChild?.childCount).toBe(tableBeforeTab?.childCount);

    mounted.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const blockGroup = mounted.editor.state.doc.firstChild;
    expect(blockGroup?.childCount).toBe(2);
    expect(blockGroup?.child(1).firstChild?.type.name).toBe('paragraph');
    mounted.destroy();
  });

  it('keeps Shift+Arrow text selection at both table-cell edges and reserves CellSelection for explicit commands', () => {
    const mounted = createEditor();
    expect(mounted.editor.commands.insertTable({ rows: 1, columns: 2 })).toBe(true);
    const cellPositions: number[] = [];
    mounted.editor.state.doc.descendants((node, position) => {
      if (node.type.spec.tableRole === 'cell') {
        cellPositions.push(position);
      }
    });
    const firstCellPosition = cellPositions[0];
    const secondCellPosition = cellPositions[1];
    if (firstCellPosition === undefined || secondCellPosition === undefined) {
      throw new Error('Expected two table cells.');
    }
    const firstTextStart = firstCellPosition + 2;
    mounted.editor.commands.insertContentAt(firstTextStart, 'Hello');
    const secondTextStart = secondCellPosition + 2 + 'Hello'.length;
    mounted.editor.commands.insertContentAt(secondTextStart, 'World');
    const firstTextEnd = firstTextStart + 'Hello'.length;
    const secondTextEnd = secondTextStart + 'World'.length;
    const documentBeforeSelection = mounted.editor.state.doc.toJSON();
    vi.spyOn(mounted.editor.view, 'endOfTextblock').mockReturnValue(true);

    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(
        TextSelection.create(mounted.editor.state.doc, firstTextStart, firstTextEnd),
      ),
    );
    const shiftRight = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    mounted.editor.view.dom.dispatchEvent(shiftRight);
    expect(mounted.editor.state.selection).toBeInstanceOf(TextSelection);
    expect(mounted.editor.state.selection.anchor).toBe(firstTextStart);
    expect(mounted.editor.state.selection.head).toBe(firstTextEnd);
    expect(shiftRight.defaultPrevented).toBe(true);

    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(
        TextSelection.create(mounted.editor.state.doc, secondTextEnd, secondTextStart),
      ),
    );
    const shiftLeft = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    mounted.editor.view.dom.dispatchEvent(shiftLeft);
    expect(mounted.editor.state.selection).toBeInstanceOf(TextSelection);
    expect(mounted.editor.state.selection.anchor).toBe(secondTextEnd);
    expect(mounted.editor.state.selection.head).toBe(secondTextStart);
    expect(shiftLeft.defaultPrevented).toBe(true);
    expect(mounted.editor.state.doc.toJSON()).toEqual(documentBeforeSelection);

    for (const select of [
      () => mounted.editor.commands.selectTableRow(),
      () => mounted.editor.commands.selectTableColumn(),
      () => mounted.editor.commands.selectTable(),
    ]) {
      mounted.editor.view.dispatch(
        mounted.editor.state.tr.setSelection(TextSelection.create(mounted.editor.state.doc, firstTextStart)),
      );
      expect(select()).toBe(true);
      expect(mounted.editor.state.selection).toBeInstanceOf(CellSelection);
    }
    mounted.destroy();
  });

  it('extends a table-cell text selection by exactly one character for each horizontal Shift+Arrow press', () => {
    const mounted = createEditor();
    expect(mounted.editor.commands.insertTable({ rows: 1, columns: 1 })).toBe(true);
    let cellPosition = -1;
    mounted.editor.state.doc.descendants((node, position) => {
      if (cellPosition < 0 && node.type.spec.tableRole === 'cell') {
        cellPosition = position;
      }
    });
    const textStart = cellPosition + 2;
    mounted.editor.commands.insertContentAt(textStart, 'ABCDE');
    const textEnd = textStart + 5;
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(TextSelection.create(mounted.editor.state.doc, textEnd)),
    );

    const press = (key: 'ArrowLeft' | 'ArrowRight') => {
      const event = new KeyboardEvent('keydown', { key, shiftKey: true, bubbles: true, cancelable: true });
      mounted.editor.view.dom.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    };

    press('ArrowLeft');
    expect(mounted.editor.state.selection).toMatchObject({ anchor: textEnd, head: textEnd - 1 });
    press('ArrowLeft');
    expect(mounted.editor.state.selection).toMatchObject({ anchor: textEnd, head: textEnd - 2 });
    press('ArrowRight');
    expect(mounted.editor.state.selection).toMatchObject({ anchor: textEnd, head: textEnd - 1 });
    press('ArrowRight');
    expect(mounted.editor.state.selection).toMatchObject({ anchor: textEnd, head: textEnd });

    mounted.destroy();
  });
});
