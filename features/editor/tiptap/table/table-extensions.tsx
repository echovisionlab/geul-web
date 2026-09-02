'use client';

import {
  Extension,
  mergeAttributes,
  type Attribute,
  type Editor,
  type Extensions,
  type NodeViewRendererProps,
} from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Selection } from '@tiptap/pm/state';
import { CellSelection, columnResizingPluginKey, TableMap, TableView } from '@tiptap/pm/tables';
import type { ViewMutationRecord } from '@tiptap/pm/view';
import { WireTable, WireTableCell, WireTableHeader, WireTableRow } from '../wire-schema';
import { createTableCommandExtension, type TableExtensionOptions } from './table-commands';
import { TABLE_DEFAULT_COLUMN_WIDTH_PX, TABLE_MIN_COLUMN_WIDTH_PX } from './table-constants';
import {
  applyTableColumnWidths,
  hasTableResizeSession,
  readTableColumnWidths,
  startTableResize,
} from './percentage-column-resizing';
import classes from './TiptapTable.module.css';

const tableColors = new Set(['default', 'gray', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']);
const tableAlignments = new Set(['left', 'center', 'right']);

function parseTableInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseColwidth(value: string | null): number[] | null {
  if (!value) {
    return null;
  }
  const widths = value.split(',').map((item) => Number(item.trim()));
  return widths.length > 0 && widths.every((width) => Number.isFinite(width) && width > 0) ? widths : null;
}

function tableCellAttributes(): Record<string, Attribute> {
  return {
    id: {
      default: null,
      rendered: false,
    },
    textColor: {
      default: 'default',
      parseHTML: (element) => {
        const value = element.getAttribute('data-text-color');
        return value && tableColors.has(value) ? value : 'default';
      },
      renderHTML: ({ textColor }) => (textColor === 'default' ? {} : { 'data-text-color': textColor }),
    },
    backgroundColor: {
      default: 'default',
      parseHTML: (element) => {
        const value = element.getAttribute('data-background-color');
        return value && tableColors.has(value) ? value : 'default';
      },
      renderHTML: ({ backgroundColor }) =>
        backgroundColor === 'default' ? {} : { 'data-background-color': backgroundColor },
    },
    textAlignment: {
      default: 'left',
      parseHTML: (element) => {
        const value = element.getAttribute('data-text-alignment');
        return value && tableAlignments.has(value) ? value : 'left';
      },
      renderHTML: ({ textAlignment }) => (textAlignment === 'left' ? {} : { 'data-text-alignment': textAlignment }),
    },
    colspan: {
      default: 1,
      parseHTML: (element) => parseTableInteger(element.getAttribute('colspan'), 1),
      renderHTML: ({ colspan }) => (colspan === 1 ? {} : { colspan }),
    },
    rowspan: {
      default: 1,
      parseHTML: (element) => parseTableInteger(element.getAttribute('rowspan'), 1),
      renderHTML: ({ rowspan }) => (rowspan === 1 ? {} : { rowspan }),
    },
    colwidth: {
      default: null,
      // ProseMirror's historical DOM used data-colwidth; accept the older
      // plain colwidth form too, then always emit canonical data-colwidth.
      parseHTML: (element) => parseColwidth(element.getAttribute('data-colwidth') ?? element.getAttribute('colwidth')),
      renderHTML: ({ colwidth }) =>
        Array.isArray(colwidth) && colwidth.length > 0 ? { 'data-colwidth': colwidth.join(',') } : {},
    },
  };
}

class TableNodeView extends TableView {
  private readonly editor: Editor;
  private readonly getPosition: NodeViewRendererProps['getPos'];
  private readonly resizeHitZones = document.createElement('div');
  private readonly onEditorUpdate = () => {
    this.dom.dataset.editorEditable = this.editor.isEditable ? 'true' : 'false';
    const selection = this.editor.state.selection;
    const tablePosition = this.getPosition();
    const tableEnd = typeof tablePosition === 'number' ? tablePosition + this.node.nodeSize : -1;
    if (
      this.editor.isEditable &&
      selection instanceof CellSelection &&
      typeof tablePosition === 'number' &&
      selection.from >= tablePosition &&
      selection.to <= tableEnd
    ) {
      this.dom.dataset.selected = 'true';
    } else {
      delete this.dom.dataset.selected;
    }
    if (!this.editor.isEditable) {
      const state = this.editor.state;
      let transaction = state.tr;
      let shouldDispatch = false;
      if (state.selection instanceof CellSelection) {
        const position = Math.min(state.selection.from + 2, state.doc.content.size);
        transaction = transaction.setSelection(Selection.near(state.doc.resolve(position)));
        shouldDispatch = true;
      }
      const columnResize = columnResizingPluginKey.getState(state);
      if (columnResize && (columnResize.activeHandle !== -1 || columnResize.dragging)) {
        transaction = transaction.setMeta(columnResizingPluginKey, { setHandle: -1 });
        shouldDispatch = true;
      }
      if (shouldDispatch) {
        this.editor.view.dispatch(transaction.setMeta('addToHistory', false));
      }
    }
  };

  constructor({ editor, getPos, node }: NodeViewRendererProps) {
    super(node, TABLE_DEFAULT_COLUMN_WIDTH_PX);
    applyTableColumnWidths(node, this.colgroup, this.table);
    this.editor = editor;
    this.getPosition = getPos;
    this.dom.className = classes.root;
    this.dom.dataset.testid = 'tiptap-table-runtime';
    this.dom.style.setProperty('--table-min-column-width', `${TABLE_MIN_COLUMN_WIDTH_PX}px`);
    this.table.className = classes.table;
    this.table.dataset.textColor = String(node.attrs.textColor);

    const scroll = document.createElement('div');
    scroll.className = classes.scroll;
    scroll.append(this.table);
    this.resizeHitZones.className = 'column-resize-hit-zones';
    this.resizeHitZones.contentEditable = 'false';
    scroll.append(this.resizeHitZones);
    this.dom.replaceChildren(scroll);
    this.updateResizeHitZones(node);

    this.editor.on('update', this.onEditorUpdate);
    this.editor.on('selectionUpdate', this.onEditorUpdate);
    this.onEditorUpdate();
  }

  private updateResizeHitZones(node: ProseMirrorNode): void {
    const tablePosition = this.getPosition();
    if (typeof tablePosition !== 'number') {
      this.resizeHitZones.replaceChildren();
      return;
    }
    const widths = readTableColumnWidths(node);
    const map = TableMap.get(node);
    const previewWidthValue = Number(node.attrs.previewWidth);
    const previewWidth = Number.isFinite(previewWidthValue) ? Math.max(10, Math.min(100, previewWidthValue)) : 100;
    const alignment =
      node.attrs.textAlignment === 'center' || node.attrs.textAlignment === 'right' ? node.attrs.textAlignment : 'left';
    const offset = alignment === 'right' ? 100 - previewWidth : alignment === 'center' ? (100 - previewWidth) / 2 : 0;
    const boundaries: Array<{
      left: number;
      kind: 'internal' | 'outer-left' | 'outer-right';
      cellPosition: number;
      column: number;
    }> = [];
    let cumulative = 0;
    if (alignment === 'right' || alignment === 'center') {
      boundaries.push({ left: offset, kind: 'outer-left', cellPosition: tablePosition + 1 + map.map[0]!, column: 0 });
    }
    for (const [column, width] of widths.slice(0, -1).entries()) {
      cumulative += width;
      boundaries.push({
        left: offset + previewWidth * (cumulative / 100),
        kind: 'internal',
        cellPosition: tablePosition + 1 + map.map[column]!,
        column,
      });
    }
    if (alignment === 'left' || alignment === 'center') {
      boundaries.push({
        left: offset + previewWidth,
        kind: 'outer-right',
        cellPosition: tablePosition + 1 + map.map[map.width - 1]!,
        column: map.width - 1,
      });
    }
    this.resizeHitZones.replaceChildren(
      ...boundaries.map(({ left, kind, cellPosition, column }) => {
        const zone = document.createElement('div');
        zone.className = `column-resize-hit-zone column-resize-hit-zone-${kind}`;
        zone.dataset.resizeBoundary = kind;
        zone.dataset.cellPosition = String(cellPosition);
        zone.dataset.resizeColumn = String(column);
        zone.style.left =
          kind === 'internal' ? `calc(${left}% - 16px)` : kind === 'outer-right' ? `calc(${left}% - 32px)` : `${left}%`;
        zone.setAttribute('aria-hidden', 'true');
        const startResize = (event: MouseEvent | PointerEvent) => {
          const started = startTableResize(this.editor.view, event);
          zone.dataset.resizeStarted = String(started);
          event.stopPropagation();
        };
        zone.addEventListener('pointerdown', startResize);
        zone.addEventListener('mousedown', (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        return zone;
      }),
    );
  }

  override update(node: ProseMirrorNode): boolean {
    if (hasTableResizeSession(this.editor.view)) {
      this.node = node;
      return true;
    }
    if (!super.update(node)) {
      return false;
    }
    applyTableColumnWidths(node, this.colgroup, this.table);
    this.updateResizeHitZones(node);
    this.table.dataset.textColor = String(node.attrs.textColor);
    return true;
  }

  selectNode(): void {
    if (this.editor.isEditable) {
      this.dom.dataset.selected = 'true';
    }
  }

  deselectNode(): void {
    delete this.dom.dataset.selected;
  }

  stopEvent(event: Event): boolean {
    return event.target instanceof Node && this.resizeHitZones.contains(event.target);
  }

  override ignoreMutation(record: ViewMutationRecord): boolean {
    if (record.target instanceof Node && this.resizeHitZones.contains(record.target)) {
      return true;
    }
    if (record.target instanceof HTMLElement && record.target.classList.contains('column-resize-guide')) {
      return true;
    }
    if (record.type === 'childList') {
      const changed = [...record.addedNodes, ...record.removedNodes];
      if (
        changed.length > 0 &&
        changed.every((node) => node instanceof HTMLElement && node.classList.contains('column-resize-guide'))
      ) {
        return true;
      }
    }
    return super.ignoreMutation(record);
  }

  destroy(): void {
    this.editor.off('update', this.onEditorUpdate);
    this.editor.off('selectionUpdate', this.onEditorUpdate);
  }
}

/**
 * Replaces only the wire-schema table nodes. All existing durable table attrs
 * survive because the replacement keeps the same names and JSON shape.
 */
export function createTiptapTableExtensions(options: TableExtensionOptions = {}): Extensions {
  const TableSchema = Extension.create({
    name: 'tableSchema',
    extendNodeSchema(extension) {
      const tableRoles: Record<string, string> = {
        table: 'table',
        tableRow: 'row',
        tableCell: 'cell',
        tableHeader: 'header_cell',
      };
      const tableRole = tableRoles[extension.name];
      return tableRole ? { tableRole } : {};
    },
  });
  const Table = WireTable.extend({
    addNodeView() {
      return (props) => new TableNodeView(props);
    },
  });
  const TableRow = WireTableRow.extend({});
  const TableCell = WireTableCell.extend({
    addAttributes() {
      return tableCellAttributes();
    },
    renderHTML({ HTMLAttributes }) {
      return ['td', mergeAttributes(HTMLAttributes, { class: classes.cell }), 0];
    },
  });
  const TableHeader = WireTableHeader.extend({
    addAttributes() {
      return tableCellAttributes();
    },
    renderHTML({ HTMLAttributes }) {
      return ['th', mergeAttributes(HTMLAttributes, { class: classes.cell }), 0];
    },
  });

  return [Table, TableRow, TableHeader, TableCell, TableSchema, createTableCommandExtension(options)];
}
