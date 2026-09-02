import type { Editor } from '@tiptap/core';
import { Fragment, type Node as ProseMirrorNode, type ResolvedPos } from '@tiptap/pm/model';
import { NodeSelection, Selection, TextSelection, type Transaction } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { createBlockId } from '@/lib/editor/block-id';

export type TextAlignment = 'left' | 'center' | 'right';
export type AlignmentDirection = 'forward' | 'backward';

const TEXT_ALIGNMENTS: readonly TextAlignment[] = ['left', 'center', 'right'];
const CONTINUING_LIST_BLOCKS = new Set(['bulletListItem', 'numberedListItem', 'checkListItem']);
const DIRECT_TEXT_BLOCKS = new Set(['paragraph', 'heading', ...CONTINUING_LIST_BLOCKS, 'quote', 'callout']);
const EXIT_TO_PARAGRAPH_BLOCKS = new Set(['heading', ...CONTINUING_LIST_BLOCKS, 'quote', 'callout']);

interface SelectedBlock {
  position: number;
  node: ProseMirrorNode;
  parent: ProseMirrorNode;
  index: number;
}

interface AlignmentTarget {
  position: number;
  node: ProseMirrorNode;
}

function closestAncestorPosition($position: ResolvedPos, nodeNames: ReadonlySet<string>) {
  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const node = $position.node(depth);
    if (nodeNames.has(node.type.name)) {
      return { node, position: $position.before(depth) };
    }
  }
  return null;
}

function closestBlock($position: ResolvedPos): SelectedBlock | null {
  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const node = $position.node(depth);
    if (node.type.name === 'blockContainer') {
      return {
        position: $position.before(depth),
        node,
        parent: $position.node(depth - 1),
        index: $position.index(depth - 1),
      };
    }
  }
  return null;
}

function directTextBlockAtSelection(editor: Editor): { content: ProseMirrorNode; block: SelectedBlock } | null {
  if (!editor.isEditable) {
    return null;
  }
  const { selection } = editor.state;
  if (!(selection instanceof TextSelection) || !selection.$from.sameParent(selection.$to)) {
    return null;
  }
  const content = selection.$from.parent;
  if (!DIRECT_TEXT_BLOCKS.has(content.type.name)) {
    return null;
  }
  const block = closestBlock(selection.$from);
  if (!block || block.parent.type.name !== 'blockGroup' || block.node.firstChild !== content) {
    return null;
  }
  return { content, block };
}

function paragraphAttributes(content: ProseMirrorNode): Record<string, unknown> {
  if (content.type.name === 'callout') {
    return {
      backgroundColor: 'default',
      textColor: 'default',
      textAlignment: 'left',
    };
  }
  return {
    backgroundColor: content.attrs.backgroundColor ?? 'default',
    textColor: content.attrs.textColor ?? 'default',
    textAlignment: content.attrs.textAlignment ?? 'left',
  };
}

function nextListAttributes(content: ProseMirrorNode): Record<string, unknown> {
  switch (content.type.name) {
    case 'numberedListItem':
      return {
        ...content.attrs,
        start: Math.max(1, Number(content.attrs.start) || 1) + 1,
      };
    case 'checkListItem':
      return { ...content.attrs, checked: false };
    default:
      return content.attrs;
  }
}

function replaceTextBlockWithParagraph(editor: Editor, content: ProseMirrorNode, block: SelectedBlock): boolean {
  const paragraphType = editor.schema.nodes.paragraph;
  if (!paragraphType) {
    return false;
  }
  const paragraph = paragraphType.create(paragraphAttributes(content), content.content, content.marks);
  const children = block.node.childCount > 1 ? block.node.child(1) : null;
  const replacementContent = children ? Fragment.fromArray([paragraph, children]) : paragraph;
  const replacement = block.node.type.create(block.node.attrs, replacementContent, block.node.marks);
  const transaction = editor.state.tr.replaceWith(block.position, block.position + block.node.nodeSize, replacement);
  transaction.setSelection(TextSelection.create(transaction.doc, block.position + 2));
  editor.view.dispatch(transaction.scrollIntoView());
  return true;
}

function moveIntoNextEmptyParagraph(editor: Editor, content: ProseMirrorNode, block: SelectedBlock): boolean {
  const { selection } = editor.state;
  if (
    !selection.empty ||
    selection.$from.parentOffset !== content.content.size ||
    block.index + 1 >= block.parent.childCount
  ) {
    return false;
  }
  const nextBlock = block.parent.child(block.index + 1);
  const nextContent = nextBlock.firstChild;
  if (nextBlock.childCount !== 1 || nextContent?.type.name !== 'paragraph' || nextContent.content.size !== 0) {
    return false;
  }
  const transaction = editor.state.tr.setSelection(
    TextSelection.create(editor.state.doc, block.position + block.node.nodeSize + 2),
  );
  editor.view.dispatch(transaction.scrollIntoView());
  return true;
}

/** Applies block-editor Enter semantics while preserving the durable source block ID. */
export function splitCurrentTextBlock(editor: Editor): boolean {
  const selected = directTextBlockAtSelection(editor);
  if (!selected) {
    return false;
  }
  const { content, block } = selected;
  const { selection } = editor.state;
  if (!(selection instanceof TextSelection)) {
    return false;
  }
  if (selection.empty && content.content.size === 0 && EXIT_TO_PARAGRAPH_BLOCKS.has(content.type.name)) {
    return replaceTextBlockWithParagraph(editor, content, block);
  }
  if (moveIntoNextEmptyParagraph(editor, content, block)) {
    return true;
  }

  const nextType = CONTINUING_LIST_BLOCKS.has(content.type.name) ? content.type : editor.schema.nodes.paragraph;
  if (!nextType) {
    return false;
  }

  const firstContent = content.type.create(
    content.attrs,
    content.content.cut(0, selection.$from.parentOffset),
    content.marks,
  );
  const nextAttributes = CONTINUING_LIST_BLOCKS.has(content.type.name)
    ? nextListAttributes(content)
    : paragraphAttributes(content);
  const secondContent = nextType.create(nextAttributes, content.content.cut(selection.$to.parentOffset), content.marks);
  const children = block.node.childCount > 1 ? block.node.child(1) : null;
  const firstBlockContent = children ? Fragment.fromArray([firstContent, children]) : firstContent;
  const firstBlock = block.node.type.create(block.node.attrs, firstBlockContent, block.node.marks);
  const secondBlock = block.node.type.create(
    { ...block.node.attrs, id: createBlockId() },
    secondContent,
    block.node.marks,
  );
  const secondBlockPosition = block.position + firstBlock.nodeSize;
  const transaction = editor.state.tr.replaceWith(
    block.position,
    block.position + block.node.nodeSize,
    Fragment.fromArray([firstBlock, secondBlock]),
  );
  transaction.setSelection(TextSelection.create(transaction.doc, secondBlockPosition + 2));
  editor.view.dispatch(transaction.scrollIntoView());
  return true;
}

function blockAtNodeSelection(editor: Editor): SelectedBlock | null {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) {
    return null;
  }
  if (selection.node.type.name === 'blockContainer') {
    return selection.$from.parent.type.name === 'blockGroup'
      ? {
          position: selection.from,
          node: selection.node,
          parent: selection.$from.parent,
          index: selection.$from.index(),
        }
      : null;
  }
  const block = closestBlock(selection.$from);
  return block &&
    block.parent.type.name === 'blockGroup' &&
    selection.from === block.position + 1 &&
    block.node.firstChild === selection.node
    ? block
    : null;
}

/** Creates a writable Paragraph immediately after an exactly selected durable Block. */
export function insertParagraphAfterSelectedBlock(editor: Editor): boolean {
  if (!editor.isEditable || editor.view.composing) {
    return false;
  }
  const block = blockAtNodeSelection(editor);
  const blockContainer = editor.schema.nodes.blockContainer;
  const paragraph = editor.schema.nodes.paragraph;
  if (!block || !blockContainer || !paragraph) {
    return false;
  }
  const nextBlock = blockContainer.createChecked({ id: createBlockId() }, paragraph.create());
  const position = block.position + block.node.nodeSize;
  const transaction = editor.state.tr.insert(position, nextBlock);
  transaction.setSelection(TextSelection.create(transaction.doc, position + 2));
  editor.view.dispatch(transaction.scrollIntoView());
  editor.view.focus();
  return true;
}

/** Inserts a locale-owned line break without creating or changing a durable block. */
export function insertHardBreakInCurrentTextBlock(editor: Editor): boolean {
  const selected = directTextBlockAtSelection(editor);
  const hardBreakType = editor.schema.nodes.hardBreak;
  if (!selected || !hardBreakType) {
    return false;
  }
  const transaction = editor.state.tr.replaceSelectionWith(hardBreakType.create());
  editor.view.dispatch(transaction.scrollIntoView());
  return true;
}

/** Joins the current direct text Block into its preceding text Block at its start. */
export function joinCurrentTextBlockBackward(editor: Editor): boolean {
  const selected = directTextBlockAtSelection(editor);
  if (!selected) {
    return false;
  }
  const { content, block } = selected;
  const { selection } = editor.state;
  if (!selection.empty || selection.$from.parentOffset !== 0 || block.node.childCount !== 1 || block.index === 0) {
    return false;
  }
  const previousBlock = block.parent.child(block.index - 1);
  const previousContent = previousBlock.firstChild;
  if (!previousContent || !DIRECT_TEXT_BLOCKS.has(previousContent.type.name)) {
    return false;
  }

  const previousPosition = block.position - previousBlock.nodeSize;
  const joinPosition = previousPosition + 2 + previousContent.content.size;
  if (content.type.name === 'paragraph' && content.content.size === 0) {
    const transaction = editor.state.tr.delete(block.position, block.position + block.node.nodeSize);
    transaction.setSelection(TextSelection.create(transaction.doc, joinPosition));
    editor.view.dispatch(transaction.scrollIntoView());
    return true;
  }
  const mergedContent = previousContent.type.create(
    previousContent.attrs,
    previousContent.content.append(content.content),
    previousContent.marks,
  );
  const children = previousBlock.childCount > 1 ? previousBlock.child(1) : null;
  const mergedBlock = previousBlock.type.create(
    previousBlock.attrs,
    children ? Fragment.fromArray([mergedContent, children]) : mergedContent,
    previousBlock.marks,
  );
  const transaction = editor.state.tr.replaceWith(previousPosition, block.position + block.node.nodeSize, mergedBlock);
  transaction.setSelection(TextSelection.create(transaction.doc, joinPosition));
  editor.view.dispatch(transaction.scrollIntoView());
  return true;
}

/** Selects the preceding durable block at a direct text/widget boundary without focusing its controls. */
export function handleCurrentTextBlockBackspace(editor: Editor): boolean {
  const selected = directTextBlockAtSelection(editor);
  if (selected) {
    const { content, block } = selected;
    const { selection } = editor.state;
    if (
      selection.empty &&
      selection.$from.parentOffset === 0 &&
      content.type.name !== 'paragraph' &&
      replaceTextBlockWithParagraph(editor, content, block)
    ) {
      return true;
    }
  }
  if (joinCurrentTextBlockBackward(editor)) {
    return true;
  }
  const current = directTextBlockAtSelection(editor);
  if (!current) {
    return false;
  }
  const { block } = current;
  const { selection } = editor.state;
  if (!selection.empty || selection.$from.parentOffset !== 0 || block.index === 0) {
    return false;
  }
  const previousBlock = block.parent.child(block.index - 1);
  const previousContent = previousBlock.firstChild;
  if (!previousContent || DIRECT_TEXT_BLOCKS.has(previousContent.type.name)) {
    return false;
  }
  const previousPosition = block.position - previousBlock.nodeSize;
  const transaction = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, previousPosition));
  editor.view.dispatch(transaction.scrollIntoView());
  return true;
}

function selectedBlocks(editor: Editor): SelectedBlock[] {
  const { doc, selection } = editor.state;

  if (selection instanceof NodeSelection) {
    if (selection.node.type.name === 'blockContainer') {
      return [
        {
          position: selection.from,
          node: selection.node,
          parent: selection.$from.parent,
          index: selection.$from.index(),
        },
      ];
    }
    const block = closestBlock(selection.$from);
    return block ? [block] : [];
  }

  if (!(selection instanceof TextSelection)) {
    return [];
  }

  if (selection.empty) {
    const block = closestBlock(selection.$from);
    return block ? [block] : [];
  }

  const blocks: SelectedBlock[] = [];
  doc.descendants((node, position, parent, index) => {
    if (node.type.name !== 'blockContainer' || !parent) {
      return true;
    }

    const content = node.firstChild;
    if (!content) {
      return false;
    }

    const contentStart = position + 1;
    const contentEnd = contentStart + content.nodeSize;
    if (selection.from < contentEnd && selection.to > contentStart) {
      blocks.push({ position, node, parent, index });
    }
    return true;
  });
  return blocks;
}

function cellAlignmentTargets(editor: Editor): AlignmentTarget[] | null {
  const { selection } = editor.state;
  if (selection instanceof CellSelection) {
    const targets: AlignmentTarget[] = [];
    selection.forEachCell((node, position) => targets.push({ node, position }));
    return targets;
  }

  const cellNames = new Set(['tableCell', 'tableHeader']);
  const anchorCell = closestAncestorPosition(selection.$anchor, cellNames);
  const headCell = closestAncestorPosition(selection.$head, cellNames);
  if (!anchorCell && !headCell) {
    return null;
  }
  if (!anchorCell || !headCell || anchorCell.position !== headCell.position) {
    return [];
  }
  return [anchorCell];
}

function alignmentTargets(editor: Editor): AlignmentTarget[] {
  const cells = cellAlignmentTargets(editor);
  if (cells !== null) {
    return cells;
  }
  return selectedBlocks(editor).flatMap(({ node, position }) => {
    const content = node.firstChild;
    return content ? [{ node: content, position: position + 1 }] : [];
  });
}

function supportsTextAlignment(target: AlignmentTarget): boolean {
  return Boolean(target.node.type.spec.attrs?.textAlignment);
}

function updateAlignmentTargets(
  editor: Editor,
  targets: readonly AlignmentTarget[],
  alignmentFor: (target: AlignmentTarget) => TextAlignment,
): boolean {
  if (targets.length === 0 || targets.some((target) => !supportsTextAlignment(target))) {
    return false;
  }

  const transaction = editor.state.tr;
  for (const target of targets) {
    const textAlignment = alignmentFor(target);
    if (target.node.attrs.textAlignment !== textAlignment) {
      transaction.setNodeMarkup(target.position, undefined, {
        ...target.node.attrs,
        textAlignment,
      });
    }
  }
  if (transaction.docChanged) {
    editor.view.dispatch(transaction.scrollIntoView());
  }
  return true;
}

export function resolveNextTextAlignment(
  currentAlignment: string | null | undefined,
  direction: AlignmentDirection,
): TextAlignment {
  const normalized = TEXT_ALIGNMENTS.includes(currentAlignment as TextAlignment)
    ? (currentAlignment as TextAlignment)
    : 'left';
  const currentIndex = TEXT_ALIGNMENTS.indexOf(normalized);
  return direction === 'forward'
    ? TEXT_ALIGNMENTS[Math.min(currentIndex + 1, TEXT_ALIGNMENTS.length - 1)]
    : TEXT_ALIGNMENTS[Math.max(currentIndex - 1, 0)];
}

export function changeCurrentBlockAlignment(editor: Editor, direction: AlignmentDirection): boolean {
  const targets = alignmentTargets(editor);
  return updateAlignmentTargets(editor, targets, (target) =>
    resolveNextTextAlignment(String(target.node.attrs.textAlignment ?? 'left'), direction),
  );
}

/** Updates the selected block content or table cells; block container IDs remain durable. */
export function setCurrentBlockAlignment(editor: Editor, textAlignment: TextAlignment): boolean {
  return updateAlignmentTargets(editor, alignmentTargets(editor), () => textAlignment);
}

function restoreMovedBlockSelection(
  transaction: Transaction,
  selection: Selection,
  oldPosition: number,
  newPosition: number,
  blockSize: number,
) {
  if (selection instanceof NodeSelection) {
    const selectedPosition = newPosition + (selection.from - oldPosition);
    transaction.setSelection(NodeSelection.create(transaction.doc, selectedPosition));
    return;
  }

  if (selection instanceof TextSelection) {
    const anchor = newPosition + (selection.anchor - oldPosition);
    const head = newPosition + (selection.head - oldPosition);
    const blockEnd = newPosition + blockSize;
    if (anchor > newPosition && anchor < blockEnd && head > newPosition && head < blockEnd) {
      transaction.setSelection(TextSelection.create(transaction.doc, anchor, head));
      return;
    }
  }

  transaction.setSelection(
    Selection.near(transaction.doc.resolve(Math.min(newPosition + 2, transaction.doc.content.size))),
  );
}

export function moveCurrentBlock(editor: Editor, direction: 'up' | 'down'): boolean {
  const blocks = selectedBlocks(editor);
  if (blocks.length !== 1) {
    return false;
  }

  const currentBlock = blocks[0];
  if (currentBlock.parent.type.name !== 'blockGroup') {
    return false;
  }

  const siblingIndex = direction === 'up' ? currentBlock.index - 1 : currentBlock.index + 1;
  if (siblingIndex < 0 || siblingIndex >= currentBlock.parent.childCount) {
    return false;
  }

  const sibling = currentBlock.parent.child(siblingIndex);
  const newPosition =
    direction === 'up' ? currentBlock.position - sibling.nodeSize : currentBlock.position + sibling.nodeSize;
  const transaction = editor.state.tr.delete(currentBlock.position, currentBlock.position + currentBlock.node.nodeSize);
  transaction.insert(newPosition, currentBlock.node);
  restoreMovedBlockSelection(
    transaction,
    editor.state.selection,
    currentBlock.position,
    newPosition,
    currentBlock.node.nodeSize,
  );
  editor.view.dispatch(transaction.scrollIntoView());
  return true;
}
