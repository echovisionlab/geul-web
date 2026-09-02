import { Extension, type Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, type Command, type Transaction, TextSelection } from '@tiptap/pm/state';
import {
  CellSelection,
  TableMap,
  type TableRect,
  addColumn,
  addColumnAfter,
  addColumnBefore,
  addRow,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  goToNextCell,
  moveTableColumn,
  moveTableRow,
  selectedRect,
  setCellAttr,
  tableEditing,
  toggleHeaderColumn,
  toggleHeaderRow,
} from '@tiptap/pm/tables';
import { createBlockId, isBlockId } from '@/lib/editor/block-id';
import { TABLE_MAX_COLUMNS, TABLE_MAX_ROWS } from './table-constants';
import {
  createPercentageColumnResizingPlugin,
  equalTableColumnWidths,
  normalizeTableWidthsInTransaction,
} from './percentage-column-resizing';

export type TableColor =
  'default' | 'gray' | 'brown' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink';
export type TableTextAlignment = 'left' | 'center' | 'right';

export type TableErrorCode = 'not-in-table' | 'invalid-table-shape' | 'invalid-table-size' | 'readonly';

export interface TableError {
  code: TableErrorCode;
  message: string;
}

export interface TableExtensionOptions {
  /** Called before an invalid table mutation is rejected. */
  onError?: (error: TableError) => void;
  /** A deliberate safety boundary against pathological document geometry. */
  maxRows?: number;
  maxColumns?: number;
}

export interface InsertTableOptions {
  rows?: number;
  columns?: number;
  withHeaderRow?: boolean;
  withHeaderColumn?: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    table: {
      insertTable: (options?: InsertTableOptions) => ReturnType;
      addTableColumnBefore: () => ReturnType;
      addTableColumnAfter: () => ReturnType;
      deleteTableColumn: () => ReturnType;
      addTableRowBefore: () => ReturnType;
      addTableRowAfter: () => ReturnType;
      deleteTableRow: () => ReturnType;
      toggleTableHeaderRow: () => ReturnType;
      toggleTableHeaderColumn: () => ReturnType;
      setTableCellTextColor: (color: TableColor) => ReturnType;
      setTableCellBackgroundColor: (color: TableColor) => ReturnType;
      setTableCellAlignment: (alignment: TableTextAlignment) => ReturnType;
      setTableAlignment: (alignment: TableTextAlignment) => ReturnType;
      selectTableRow: () => ReturnType;
      selectTableColumn: () => ReturnType;
      selectTable: () => ReturnType;
      extendTableRow: () => ReturnType;
      extendTableColumn: () => ReturnType;
      moveTableRow: (from: number, to: number) => ReturnType;
      moveTableColumn: (from: number, to: number) => ReturnType;
      removeTable: () => ReturnType;
    };
  }
}

function report(options: TableExtensionOptions, code: TableErrorCode, message: string): false {
  options.onError?.({ code, message });
  return false;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function validateCellGeometry(cell: ProseMirrorNode): string | null {
  const colspan = cell.attrs.colspan;
  const rowspan = cell.attrs.rowspan;
  const colwidth = cell.attrs.colwidth;
  if (!isPositiveInteger(colspan) || !isPositiveInteger(rowspan)) {
    return 'A table cell has a non-positive or non-integer span.';
  }
  if (
    colwidth !== null &&
    (!Array.isArray(colwidth) ||
      colwidth.length !== colspan ||
      colwidth.some((width) => typeof width !== 'number' || !Number.isFinite(width) || width <= 0))
  ) {
    return 'A table cell has an invalid persisted column-width vector.';
  }
  return null;
}

/**
 * Validates geometry without normalising it. A malformed remote/document payload
 * is surfaced to the caller instead of silently changing durable table state.
 */
export function getTableGeometryError(table: ProseMirrorNode): string | null {
  if (table.type.spec.tableRole !== 'table') {
    return 'The selected node is not a table.';
  }
  let error: string | null = null;
  table.descendants((node) => {
    if (node.type.spec.tableRole === 'cell' || node.type.spec.tableRole === 'header_cell') {
      error ??= validateCellGeometry(node);
      return !error;
    }
    return true;
  });
  if (error) {
    return error;
  }
  const map = TableMap.get(table);
  if (map.width < 1 || map.height < 1) {
    return 'A table must contain at least one row and one column.';
  }
  return map.problems?.[0] ? `The table has invalid geometry: ${map.problems[0].type}.` : null;
}

function tableAtSelection(editor: Editor): { position: number; node: ProseMirrorNode } | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.spec.tableRole === 'table') {
      return { position: $from.before(depth), node };
    }
  }
  return null;
}

function cellRangeAtSelection(editor: Editor) {
  const selection = editor.state.selection;
  if (selection instanceof CellSelection) {
    return { $anchorCell: selection.$anchorCell, $headCell: selection.$headCell };
  }
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const role = $from.node(depth).type.spec.tableRole;
    if (role === 'cell' || role === 'header_cell') {
      const $cell = editor.state.doc.resolve($from.before(depth));
      return { $anchorCell: $cell, $headCell: $cell };
    }
  }
  return null;
}

function documentGeometryError(
  doc: ProseMirrorNode,
  options: Pick<TableExtensionOptions, 'maxRows' | 'maxColumns'> = {},
): string | null {
  let error: string | null = null;
  doc.descendants((node) => {
    if (node.type.spec.tableRole === 'table') {
      error ??= getTableGeometryError(node);
      const map = TableMap.get(node);
      if (
        !error &&
        (map.height > (options.maxRows ?? TABLE_MAX_ROWS) || map.width > (options.maxColumns ?? TABLE_MAX_COLUMNS))
      ) {
        error = `The table exceeds the ${options.maxRows ?? TABLE_MAX_ROWS}×${options.maxColumns ?? TABLE_MAX_COLUMNS} geometry limit.`;
      }
      return !error;
    }
    return true;
  });
  return error;
}

function ensureTableIdentitiesInTransaction(transaction: Transaction): void {
  const rowIds = new Set<string>();
  const cellIds = new Set<string>();
  const fixes: Array<{ position: number; attrs: Record<string, unknown> }> = [];
  transaction.doc.descendants((node, position) => {
    const role = node.type.spec.tableRole;
    const ids = role === 'row' ? rowIds : role === 'cell' || role === 'header_cell' ? cellIds : null;
    if (!ids) {
      return true;
    }
    const id = node.attrs.id;
    if (!isBlockId(id) || ids.has(id)) {
      const nextId = createBlockId();
      ids.add(nextId);
      fixes.push({ position, attrs: { ...node.attrs, id: nextId } });
    } else {
      ids.add(id);
    }
    return true;
  });
  for (const fix of fixes) {
    transaction.setNodeMarkup(fix.position, undefined, fix.attrs);
  }
}

function guardedTableCommand(command: Command, options: TableExtensionOptions, growth?: 'row' | 'column') {
  return ({ editor, tr }: { editor: Editor; tr: Transaction }) => {
    if (!editor.isEditable) {
      return report(options, 'readonly', 'The table is read-only.');
    }
    const selected = tableAtSelection(editor);
    if (!selected) {
      return report(options, 'not-in-table', 'Place the cursor in a table first.');
    }
    const before = getTableGeometryError(selected.node);
    if (before) {
      return report(options, 'invalid-table-shape', before);
    }
    const map = TableMap.get(selected.node);
    if (
      (growth === 'row' && map.height >= (options.maxRows ?? TABLE_MAX_ROWS)) ||
      (growth === 'column' && map.width >= (options.maxColumns ?? TABLE_MAX_COLUMNS))
    ) {
      return report(
        options,
        'invalid-table-size',
        `The table exceeds the ${options.maxRows ?? TABLE_MAX_ROWS}×${options.maxColumns ?? TABLE_MAX_COLUMNS} geometry limit.`,
      );
    }
    return command(editor.state, (transaction) => {
      ensureTableIdentitiesInTransaction(transaction);
      normalizeTableWidthsInTransaction(transaction);
      const after = documentGeometryError(transaction.doc, options);
      if (after) {
        report(options, after.includes('geometry limit') ? 'invalid-table-size' : 'invalid-table-shape', after);
        return;
      }
      tr.setMeta('preventDispatch', true);
      editor.view.dispatch(transaction.scrollIntoView());
    });
  };
}

function guardedTableTransform(
  transform: (
    transaction: Transaction,
    table: ProseMirrorNode,
    map: TableMap,
    tableStart: number,
    rect: TableRect,
  ) => boolean,
  options: TableExtensionOptions,
) {
  return ({ editor, tr }: { editor: Editor; tr: Transaction }) => {
    if (!editor.isEditable) {
      return report(options, 'readonly', 'The table is read-only.');
    }
    const selected = tableAtSelection(editor);
    if (!selected) {
      return report(options, 'not-in-table', 'Place the cursor in a table first.');
    }
    const before = getTableGeometryError(selected.node);
    if (before) {
      return report(options, 'invalid-table-shape', before);
    }
    const map = TableMap.get(selected.node);
    if (!transform(tr, selected.node, map, selected.position + 1, selectedRect(editor.state))) {
      return false;
    }
    ensureTableIdentitiesInTransaction(tr);
    normalizeTableWidthsInTransaction(tr);
    const after = documentGeometryError(tr.doc, options);
    if (after) {
      return report(options, after.includes('geometry limit') ? 'invalid-table-size' : 'invalid-table-shape', after);
    }
    return true;
  };
}

function cellDepthAtSelection(editor: Editor): number | undefined {
  const { $from } = editor.state.selection;
  return [...Array($from.depth).keys()]
    .reverse()
    .find(
      (depth) =>
        $from.node(depth).type.spec.tableRole === 'cell' || $from.node(depth).type.spec.tableRole === 'header_cell',
    );
}

function isAtTableCellStart(editor: Editor): boolean {
  const { selection } = editor.state;
  if (!selection.empty || !(selection instanceof TextSelection) || selection.$from.parentOffset !== 0) {
    return false;
  }
  return cellDepthAtSelection(editor) !== undefined;
}

function guardedKeyboardCommand(editor: Editor, command: Command, options: TableExtensionOptions): boolean {
  if (!editor.isEditable || editor.view.composing) {
    return false;
  }
  const selected = tableAtSelection(editor);
  if (!selected) {
    return false;
  }
  const before = getTableGeometryError(selected.node);
  if (before) {
    return report(options, 'invalid-table-shape', before);
  }
  return command(editor.state, (transaction) => {
    const after = documentGeometryError(transaction.doc, options);
    if (after) {
      report(options, after.includes('geometry limit') ? 'invalid-table-size' : 'invalid-table-shape', after);
      return;
    }
    editor.view.dispatch(transaction.scrollIntoView());
  });
}

function tableContainerAtSelection(editor: Editor): { position: number; node: ProseMirrorNode } | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'blockContainer') {
      return { position: $from.before(depth), node: $from.node(depth) };
    }
  }
  return null;
}

/**
 * The editor exits a table on Enter instead of splitting the table cell. The
 * new paragraph is a sibling block, so the table's geometry cannot change.
 */
function exitTableBelow(editor: Editor, options: TableExtensionOptions): boolean {
  if (!editor.isEditable || editor.view.composing) {
    return false;
  }
  const selected = tableAtSelection(editor);
  const container = tableContainerAtSelection(editor);
  if (!selected || !container) {
    return false;
  }
  const geometryError = getTableGeometryError(selected.node);
  if (geometryError) {
    return report(options, 'invalid-table-shape', geometryError);
  }
  const blockContainer = editor.schema.nodes.blockContainer;
  const paragraph = editor.schema.nodes.paragraph;
  if (!blockContainer || !paragraph) {
    return report(options, 'invalid-table-shape', 'The editor cannot create a table exit paragraph.');
  }
  const nextBlock = blockContainer.createChecked({ id: createBlockId() }, paragraph.create());
  const position = container.position + container.node.nodeSize;
  const transaction = editor.state.tr.insert(position, nextBlock);
  const after = documentGeometryError(transaction.doc, options);
  if (after) {
    return report(options, after.includes('geometry limit') ? 'invalid-table-size' : 'invalid-table-shape', after);
  }
  transaction.setSelection(TextSelection.create(transaction.doc, position + 2));
  editor.view.dispatch(transaction.scrollIntoView());
  return true;
}

function createTableGeometryGuardPlugin(options: TableExtensionOptions) {
  return new Plugin({
    filterTransaction(transaction) {
      if (!transaction.docChanged) {
        return true;
      }
      const error = documentGeometryError(transaction.doc, options);
      if (!error) {
        return true;
      }
      report(options, error.includes('geometry limit') ? 'invalid-table-size' : 'invalid-table-shape', error);
      return false;
    },
  });
}

function isTableTextSelection(selection: TextSelection): boolean {
  for (let depth = selection.$head.depth; depth > 0; depth -= 1) {
    const role = selection.$head.node(depth).type.spec.tableRole;
    if (role === 'cell' || role === 'header_cell') {
      return true;
    }
  }
  return false;
}

function extendTableTextSelection(
  view: Parameters<NonNullable<Plugin['props']['handleKeyDown']>>[0],
  event: KeyboardEvent,
) {
  const selection = view.state.selection;
  if (
    !(selection instanceof TextSelection) ||
    !selection.$head.parent.isTextblock ||
    !isTableTextSelection(selection) ||
    !event.shiftKey ||
    (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
  ) {
    return false;
  }

  const direction = event.key === 'ArrowLeft' ? -1 : 1;
  const textblockStart = selection.$head.start();
  const textblockEnd = selection.$head.end();
  const nextHead = Math.max(textblockStart, Math.min(textblockEnd, selection.head + direction));
  if (nextHead !== selection.head) {
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, selection.anchor, nextHead)));
  }
  return true;
}

function createExplicitTableEditingPlugin(): Plugin {
  const canonical = tableEditing({ allowTableNodeSelection: false });
  const canonicalProps = canonical.spec.props ?? {};
  const canonicalKeyDown = canonicalProps.handleKeyDown;
  const canonicalMouseDown = canonicalProps.handleDOMEvents?.mousedown;
  return new Plugin({
    ...canonical.spec,
    props: {
      ...canonicalProps,
      handleKeyDown(view, event) {
        if (extendTableTextSelection(view, event)) {
          return true;
        }
        if (view.state.selection instanceof TextSelection && event.shiftKey && event.key.startsWith('Arrow')) {
          return false;
        }
        return canonicalKeyDown?.call(canonical, view, event) ?? false;
      },
      handleDOMEvents: {
        ...canonicalProps.handleDOMEvents,
        mousedown(view, event) {
          if (!(view.state.selection instanceof CellSelection)) {
            return false;
          }
          return canonicalMouseDown?.call(canonical, view, event) ?? false;
        },
      },
      handleTripleClick() {
        return false;
      },
    },
  });
}

function currentBlockContent(editor: Editor): { position: number; node: ProseMirrorNode } | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'blockContainer') {
      const position = $from.before(depth) + 1;
      const node = editor.state.doc.nodeAt(position);
      return node ? { position, node } : null;
    }
  }
  return null;
}

export function createTableNode(editor: Editor, options: Required<InsertTableOptions>): ProseMirrorNode | null {
  const table = editor.schema.nodes.table;
  const row = editor.schema.nodes.tableRow;
  const cell = editor.schema.nodes.tableCell;
  const header = editor.schema.nodes.tableHeader;
  const paragraph = editor.schema.nodes.tableParagraph;
  if (!table || !row || !cell || !header || !paragraph) {
    return null;
  }
  const columnWidths = equalTableColumnWidths(options.columns);
  const rows = Array.from({ length: options.rows }, (_, rowIndex) =>
    row.createChecked(
      { id: createBlockId() },
      Array.from({ length: options.columns }, (_, columnIndex) => {
        const isHeader = (options.withHeaderRow && rowIndex === 0) || (options.withHeaderColumn && columnIndex === 0);
        return (isHeader ? header : cell).createChecked(
          { id: createBlockId(), colwidth: [columnWidths[columnIndex]] },
          paragraph.create(),
        );
      }),
    ),
  );
  return table.createChecked(undefined, rows);
}

export function createTableCommands(options: TableExtensionOptions = {}) {
  const limits = {
    maxRows: options.maxRows ?? TABLE_MAX_ROWS,
    maxColumns: options.maxColumns ?? TABLE_MAX_COLUMNS,
  };
  const guarded = (command: Command, growth?: 'row' | 'column') => guardedTableCommand(command, options, growth);
  return {
    insertTable:
      (input: InsertTableOptions = {}) =>
      ({ editor, tr }: { editor: Editor; tr: Transaction }) => {
        if (!editor.isEditable) {
          return report(options, 'readonly', 'The table is read-only.');
        }
        const tableOptions: Required<InsertTableOptions> = {
          rows: input.rows ?? 3,
          columns: input.columns ?? 3,
          withHeaderRow: input.withHeaderRow ?? false,
          withHeaderColumn: input.withHeaderColumn ?? false,
        };
        if (
          !isPositiveInteger(tableOptions.rows) ||
          !isPositiveInteger(tableOptions.columns) ||
          tableOptions.rows > limits.maxRows ||
          tableOptions.columns > limits.maxColumns
        ) {
          return report(
            options,
            'invalid-table-size',
            `Table dimensions must be integers from 1 to ${limits.maxRows}×${limits.maxColumns}.`,
          );
        }
        const node = createTableNode(editor, tableOptions);
        const geometryError = node ? getTableGeometryError(node) : 'The table node is unavailable.';
        if (!node || geometryError) {
          return report(options, 'invalid-table-shape', `Could not create a valid table shape: ${geometryError}`);
        }
        const target = currentBlockContent(editor);
        if (!target) {
          return report(options, 'not-in-table', 'Place the cursor in an editable block first.');
        }
        tr.replaceWith(target.position, target.position + target.node.nodeSize, node).scrollIntoView();
        return true;
      },
    addTableColumnBefore: () => guarded(addColumnBefore, 'column'),
    addTableColumnAfter: () => guarded(addColumnAfter, 'column'),
    deleteTableColumn: () => guarded(deleteColumn),
    addTableRowBefore: () => guarded(addRowBefore, 'row'),
    addTableRowAfter: () => guarded(addRowAfter, 'row'),
    deleteTableRow: () => guarded(deleteRow),
    toggleTableHeaderRow: () => guarded(toggleHeaderRow),
    toggleTableHeaderColumn: () => guarded(toggleHeaderColumn),
    setTableCellTextColor: (color: TableColor) => guarded(setCellAttr('textColor', color)),
    setTableCellBackgroundColor: (color: TableColor) => guarded(setCellAttr('backgroundColor', color)),
    setTableCellAlignment: (alignment: TableTextAlignment) => guarded(setCellAttr('textAlignment', alignment)),
    setTableAlignment:
      (alignment: TableTextAlignment) =>
      ({ editor, tr }: { editor: Editor; tr: Transaction }) => {
        if (!editor.isEditable) {
          return report(options, 'readonly', 'The table is read-only.');
        }
        const selected = tableAtSelection(editor);
        if (!selected) {
          return report(options, 'not-in-table', 'Place the cursor in a table first.');
        }
        if (!['left', 'center', 'right'].includes(alignment)) {
          return report(options, 'invalid-table-shape', 'The table alignment is invalid.');
        }
        const cellSelection =
          editor.state.selection instanceof CellSelection
            ? {
                anchor: editor.state.selection.$anchorCell.pos,
                head: editor.state.selection.$headCell.pos,
              }
            : null;
        tr.setNodeMarkup(selected.position, undefined, { ...selected.node.attrs, textAlignment: alignment });
        if (cellSelection) {
          tr.setSelection(CellSelection.create(tr.doc, cellSelection.anchor, cellSelection.head));
        }
        return true;
      },
    selectTableRow:
      () =>
      ({ editor, tr }: { editor: Editor; tr: Transaction }) => {
        const selected = tableAtSelection(editor);
        if (!selected) {
          return report(options, 'not-in-table', 'Place the cursor in a table first.');
        }
        const cells = cellRangeAtSelection(editor);
        if (!cells) {
          return report(options, 'not-in-table', 'Place the cursor in a table cell first.');
        }
        tr.setSelection(CellSelection.rowSelection(cells.$anchorCell, cells.$headCell)).scrollIntoView();
        return true;
      },
    selectTableColumn:
      () =>
      ({ editor, tr }: { editor: Editor; tr: Transaction }) => {
        const selected = tableAtSelection(editor);
        if (!selected) {
          return report(options, 'not-in-table', 'Place the cursor in a table first.');
        }
        const cells = cellRangeAtSelection(editor);
        if (!cells) {
          return report(options, 'not-in-table', 'Place the cursor in a table cell first.');
        }
        tr.setSelection(CellSelection.colSelection(cells.$anchorCell, cells.$headCell)).scrollIntoView();
        return true;
      },
    selectTable:
      () =>
      ({ editor, tr }: { editor: Editor; tr: Transaction }) => {
        const selected = tableAtSelection(editor);
        if (!selected) {
          return report(options, 'not-in-table', 'Place the cursor in a table first.');
        }
        const map = TableMap.get(selected.node);
        const anchor = selected.position + 1 + map.map[0];
        const head = selected.position + 1 + map.map[map.map.length - 1];
        tr.setSelection(CellSelection.create(editor.state.doc, anchor, head)).scrollIntoView();
        return true;
      },
    extendTableRow: () =>
      guardedTableTransform((transaction, _table, map, _tableStart, rect) => {
        if (map.height >= (options.maxRows ?? TABLE_MAX_ROWS)) {
          report(
            options,
            'invalid-table-size',
            `The table exceeds the ${options.maxRows ?? TABLE_MAX_ROWS}×${options.maxColumns ?? TABLE_MAX_COLUMNS} geometry limit.`,
          );
          return false;
        }
        addRow(transaction, rect, map.height);
        return transaction.docChanged;
      }, options),
    extendTableColumn: () =>
      guardedTableTransform((transaction, _table, map, _tableStart, rect) => {
        if (map.width >= (options.maxColumns ?? TABLE_MAX_COLUMNS)) {
          report(
            options,
            'invalid-table-size',
            `The table exceeds the ${options.maxRows ?? TABLE_MAX_ROWS}×${options.maxColumns ?? TABLE_MAX_COLUMNS} geometry limit.`,
          );
          return false;
        }
        addColumn(transaction, rect, map.width);
        return transaction.docChanged;
      }, options),
    moveTableRow:
      (from: number, to: number) =>
      ({ editor, tr }: { editor: Editor; tr: Transaction }) => {
        if (!editor.isEditable) {
          return report(options, 'readonly', 'The table is read-only.');
        }
        if (!Number.isInteger(from) || !Number.isInteger(to)) {
          return report(options, 'invalid-table-shape', 'Table row indexes must be integers.');
        }
        const selected = tableAtSelection(editor);
        if (!selected) {
          return report(options, 'not-in-table', 'Place the cursor in a table first.');
        }
        const map = TableMap.get(selected.node);
        if (from < 0 || to < 0 || from >= map.height || to >= map.height) {
          return report(options, 'invalid-table-shape', 'The requested table row index is outside the table.');
        }
        tr.setMeta('preventDispatch', true);
        return guardedKeyboardCommand(editor, moveTableRow({ from, to, select: true }), options);
      },
    moveTableColumn:
      (from: number, to: number) =>
      ({ editor, tr }: { editor: Editor; tr: Transaction }) => {
        if (!editor.isEditable) {
          return report(options, 'readonly', 'The table is read-only.');
        }
        if (!Number.isInteger(from) || !Number.isInteger(to)) {
          return report(options, 'invalid-table-shape', 'Table column indexes must be integers.');
        }
        const selected = tableAtSelection(editor);
        if (!selected) {
          return report(options, 'not-in-table', 'Place the cursor in a table first.');
        }
        const map = TableMap.get(selected.node);
        if (from < 0 || to < 0 || from >= map.width || to >= map.width) {
          return report(options, 'invalid-table-shape', 'The requested table column index is outside the table.');
        }
        tr.setMeta('preventDispatch', true);
        return guardedKeyboardCommand(editor, moveTableColumn({ from, to, select: true }), options);
      },
    removeTable: () => guarded(deleteTable),
  };
}

/** Adds canonical ProseMirror interaction plugins and guarded table commands. */
export function createTableCommandExtension(options: TableExtensionOptions = {}) {
  return Extension.create({
    name: 'tableCommands',
    addCommands() {
      return createTableCommands(options);
    },
    addProseMirrorPlugins() {
      // The editor keeps durable widths as percentages. The canonical
      // prosemirror-tables resize plugin writes pixels, so only its table
      // selection/editing behavior is reused here.
      return [
        createTableGeometryGuardPlugin(options),
        createPercentageColumnResizingPlugin(),
        // This plugin owns cell selection and may normalize a transaction's
        // table grid. The guard above rejects malformed persisted geometry
        // before a normalizing transaction can be applied silently.
        createExplicitTableEditingPlugin(),
      ];
    },
    addKeyboardShortcuts() {
      return {
        Tab: () => guardedKeyboardCommand(this.editor, goToNextCell(1), options),
        'Shift-Tab': () => guardedKeyboardCommand(this.editor, goToNextCell(-1), options),
        Enter: () => exitTableBelow(this.editor, options),
        Backspace: () => {
          if (this.editor.view.composing || !isAtTableCellStart(this.editor)) {
            return false;
          }
          const selected = tableAtSelection(this.editor);
          return selected && getTableGeometryError(selected.node)
            ? report(options, 'invalid-table-shape', getTableGeometryError(selected.node)!)
            : true;
        },
      };
    },
  });
}
