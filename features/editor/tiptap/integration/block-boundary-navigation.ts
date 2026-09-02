import { Extension, type Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { NodeSelection, Plugin, Selection, TextSelection } from '@tiptap/pm/state';
import { CellSelection, TableMap } from '@tiptap/pm/tables';

export type BlockBoundaryDirection = 'up' | 'down';

export interface BlockBoundary {
  contentPosition: number;
  groupDepth: number;
  position: number;
  node: ProseMirrorNode;
}

interface PendingTableBoundarySelection {
  anchorCell: number;
  headCell: number;
}

interface TableBoundaryEntry extends PendingTableBoundarySelection {
  direction: BlockBoundaryDirection;
}

const pendingTableBoundarySelections = new WeakMap<Editor, PendingTableBoundarySelection>();
const tableBoundaryEntries = new WeakMap<Editor, TableBoundaryEntry>();

function sameCellSelection(selection: CellSelection, pending: PendingTableBoundarySelection): boolean {
  return selection.$anchorCell.pos === pending.anchorCell && selection.$headCell.pos === pending.headCell;
}

function guardTableBoundarySelection(editor: Editor, selection: PendingTableBoundarySelection): void {
  pendingTableBoundarySelections.set(editor, selection);
}

function clearPendingTableBoundarySelection(editor: Editor): void {
  pendingTableBoundarySelections.delete(editor);
}

/**
 * Standalone content follows ProseMirror's native selectable-atom contract.
 * Code blocks keep an outer boundary while retaining editable text content.
 */
export function isStandaloneBlockContent(node: ProseMirrorNode): boolean {
  return (
    node.type.name === 'codeBlock' ||
    (NodeSelection.isSelectable(node) && (node.isAtom || (node.type.spec.isolating === true && !node.isTextblock)))
  );
}

export function blockBoundaryAt($position: ResolvedPos): BlockBoundary | null {
  for (let depth = $position.depth; depth > 0; depth -= 1) {
    if ($position.node(depth).type.name === 'blockContainer' && $position.node(depth - 1).type.name === 'blockGroup') {
      const position = $position.before(depth);
      return {
        contentPosition: position + 1,
        groupDepth: depth - 1,
        node: $position.node(depth),
        position,
      };
    }
  }
  return null;
}

export function adjacentBlockBoundary(
  doc: ProseMirrorNode,
  current: BlockBoundary,
  direction: BlockBoundaryDirection,
): BlockBoundary | null {
  const $position = doc.resolve(current.position);
  if ($position.parent.type.name !== 'blockGroup') {
    return null;
  }
  const targetIndex = $position.index() + (direction === 'down' ? 1 : -1);
  if (targetIndex < 0 || targetIndex >= $position.parent.childCount) {
    return null;
  }
  let position = $position.start();
  for (let index = 0; index < targetIndex; index += 1) {
    position += $position.parent.child(index).nodeSize;
  }
  return {
    contentPosition: position + 1,
    groupDepth: current.groupDepth,
    node: $position.parent.child(targetIndex),
    position,
  };
}

function currentBlock(editor: Editor): BlockBoundary | null {
  return blockBoundaryAt(editor.state.selection.$from);
}

function scrollBoundaryIntoView(editor: Editor, position: number): void {
  const element = editor.view.nodeDOM(position);
  if (element instanceof HTMLElement && typeof element.scrollIntoView === 'function') {
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function selectBlockBoundary(
  editor: Editor,
  block: BlockBoundary,
  entryDirection: BlockBoundaryDirection | null = null,
): boolean {
  const content = block.node.firstChild;
  if (!content) {
    return false;
  }
  if (isStandaloneBlockContent(content)) {
    tableBoundaryEntries.delete(editor);
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, block.contentPosition)));
    editor.view.focus();
    scrollBoundaryIntoView(editor, block.contentPosition);
    return true;
  }
  if (content.type.name === 'table') {
    const map = TableMap.get(content);
    const firstCell = map.map[0];
    const lastCell = map.map[map.map.length - 1];
    if (firstCell === undefined || lastCell === undefined) {
      return false;
    }
    const tablePosition = block.contentPosition;
    const anchorCell = tablePosition + 1 + firstCell;
    const headCell = tablePosition + 1 + lastCell;
    if (entryDirection) {
      tableBoundaryEntries.set(editor, { anchorCell, headCell, direction: entryDirection });
    } else {
      tableBoundaryEntries.delete(editor);
    }
    guardTableBoundarySelection(editor, { anchorCell, headCell });
    editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, anchorCell, headCell)));
    editor.view.focus();
    scrollBoundaryIntoView(editor, tablePosition);
    return true;
  }
  return false;
}

function enterFirstTableCell(editor: Editor, current: BlockBoundary, direction: BlockBoundaryDirection): boolean {
  const entry = tableBoundaryEntries.get(editor);
  const table = current.node.firstChild;
  if (
    !entry ||
    entry.direction !== direction ||
    table?.type.name !== 'table' ||
    !isWholeTableSelection(editor, current)
  ) {
    return false;
  }
  const firstCell = TableMap.get(table).map[0];
  if (firstCell === undefined) {
    return false;
  }
  const cellPosition = current.contentPosition + 1 + firstCell;
  const selection = Selection.near(editor.state.doc.resolve(cellPosition + 1), 1);
  if (!(selection instanceof TextSelection)) {
    return false;
  }
  pendingTableBoundarySelections.delete(editor);
  tableBoundaryEntries.delete(editor);
  editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView());
  editor.view.focus();
  scrollBoundaryIntoView(editor, current.contentPosition);
  return true;
}

function isWholeTableSelection(editor: Editor, block: BlockBoundary): boolean {
  const { selection } = editor.state;
  const table = block.node.firstChild;
  if (!(selection instanceof CellSelection) || table?.type.name !== 'table') {
    return false;
  }
  const map = TableMap.get(table);
  const firstCell = map.map[0];
  const lastCell = map.map[map.map.length - 1];
  if (firstCell === undefined || lastCell === undefined) {
    return false;
  }
  const firstPosition = block.contentPosition + 1 + firstCell;
  const lastPosition = block.contentPosition + 1 + lastCell;
  return (
    (selection.$anchorCell.pos === firstPosition && selection.$headCell.pos === lastPosition) ||
    (selection.$anchorCell.pos === lastPosition && selection.$headCell.pos === firstPosition)
  );
}

function tableTextExit(editor: Editor, direction: BlockBoundaryDirection): boolean | null {
  const { $from } = editor.state.selection;
  let tableDepth = -1;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') {
      tableDepth = depth;
      break;
    }
  }
  if (tableDepth < 0) {
    return null;
  }
  if (!$from.parent.isTextblock || !editor.state.selection.empty) {
    return false;
  }
  const rowIndex = $from.index(tableDepth);
  const table = $from.node(tableDepth);
  return direction === 'down' ? rowIndex === table.childCount - 1 : rowIndex === 0;
}

function leaveSelectedBoundary(editor: Editor, current: BlockBoundary, direction: BlockBoundaryDirection): boolean {
  const { selection } = editor.state;
  const selectedBoundary =
    (selection instanceof NodeSelection && isStandaloneBlockContent(selection.node)) ||
    isWholeTableSelection(editor, current);
  if (!selectedBoundary) {
    return false;
  }
  const target = adjacentBlockBoundary(editor.state.doc, current, direction);
  const content = target?.node.firstChild;
  if (!target || !content) {
    return false;
  }
  if (selectBlockBoundary(editor, target, direction)) {
    return true;
  }
  if (!content.isTextblock) {
    return false;
  }
  const position =
    direction === 'down' ? target.contentPosition + 1 : target.contentPosition + 1 + content.content.size;
  pendingTableBoundarySelections.delete(editor);
  tableBoundaryEntries.delete(editor);
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, position)).scrollIntoView());
  editor.view.focus();
  return true;
}

export function handleBlockBoundaryArrow(editor: Editor, direction: BlockBoundaryDirection): boolean {
  const entry = tableBoundaryEntries.get(editor);
  if (
    entry &&
    (!(editor.state.selection instanceof CellSelection) || !sameCellSelection(editor.state.selection, entry))
  ) {
    tableBoundaryEntries.delete(editor);
  }
  const current = currentBlock(editor);
  if (!current) {
    return false;
  }
  if (enterFirstTableCell(editor, current, direction)) {
    return true;
  }
  if (leaveSelectedBoundary(editor, current, direction)) {
    return true;
  }
  const tableExit = tableTextExit(editor, direction);
  if (tableExit === true) {
    return selectBlockBoundary(editor, current);
  }
  const atBoundary = tableExit ?? editor.view.endOfTextblock(direction);
  if (!editor.state.selection.empty || !atBoundary) {
    return false;
  }
  const target = adjacentBlockBoundary(editor.state.doc, current, direction);
  return target ? selectBlockBoundary(editor, target, direction) : false;
}

export const BlockBoundaryNavigation = Extension.create({
  name: 'blockBoundaryNavigation',
  priority: 1200,
  addKeyboardShortcuts() {
    return {
      ArrowDown: () => handleBlockBoundaryArrow(this.editor, 'down'),
      ArrowUp: () => handleBlockBoundaryArrow(this.editor, 'up'),
    };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        view(view) {
          const ownerDocument = view.dom.ownerDocument;
          const releaseGuard = () => clearPendingTableBoundarySelection(editor);
          ownerDocument.addEventListener('keydown', releaseGuard, true);
          ownerDocument.addEventListener('pointerdown', releaseGuard, true);
          ownerDocument.addEventListener('mousedown', releaseGuard, true);
          return {
            destroy() {
              ownerDocument.removeEventListener('keydown', releaseGuard, true);
              ownerDocument.removeEventListener('pointerdown', releaseGuard, true);
              ownerDocument.removeEventListener('mousedown', releaseGuard, true);
            },
          };
        },
        filterTransaction(transaction, state) {
          const pending = pendingTableBoundarySelections.get(editor);
          if (!pending) {
            if (transaction.docChanged && transaction.selection instanceof CellSelection) {
              guardTableBoundarySelection(editor, {
                anchorCell: transaction.selection.$anchorCell.pos,
                headCell: transaction.selection.$headCell.pos,
              });
            }
            return true;
          }
          if (transaction.selection instanceof CellSelection && sameCellSelection(transaction.selection, pending)) {
            return true;
          }
          if (!(state.selection instanceof CellSelection) || !sameCellSelection(state.selection, pending)) {
            clearPendingTableBoundarySelection(editor);
            return true;
          }
          if (transaction.selection instanceof TextSelection) {
            return false;
          }
          if (transaction.docChanged) {
            if (transaction.selection instanceof CellSelection) {
              guardTableBoundarySelection(editor, {
                anchorCell: transaction.selection.$anchorCell.pos,
                headCell: transaction.selection.$headCell.pos,
              });
            } else {
              clearPendingTableBoundarySelection(editor);
            }
            return true;
          }
          if (!transaction.selectionSet) {
            return true;
          }
          if (!(transaction.selection instanceof CellSelection) || !sameCellSelection(transaction.selection, pending)) {
            clearPendingTableBoundarySelection(editor);
          }
          return true;
        },
      }),
    ];
  },
});
