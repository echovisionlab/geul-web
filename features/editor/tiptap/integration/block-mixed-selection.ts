import { Extension, type Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { Plugin, Selection, TextSelection, type EditorState, type SelectionBookmark } from '@tiptap/pm/state';
import type { Mappable } from '@tiptap/pm/transform';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import {
  adjacentBlockBoundary,
  blockBoundaryAt,
  isStandaloneBlockContent,
  type BlockBoundary,
  type BlockBoundaryDirection,
} from './block-boundary-navigation';

type MixedSelectionDirection = 'left' | 'right' | BlockBoundaryDirection;

function isForward(direction: MixedSelectionDirection): boolean {
  return direction === 'right' || direction === 'down';
}

function isStandaloneBlock(block: ProseMirrorNode | null | undefined): block is ProseMirrorNode {
  return Boolean(
    block?.type.name === 'blockContainer' && block.firstChild && isStandaloneBlockContent(block.firstChild),
  );
}

function isStandaloneBoundary(position: ResolvedPos): boolean {
  return (
    position.parent.type.name === 'blockGroup' &&
    (isStandaloneBlock(position.nodeBefore) || isStandaloneBlock(position.nodeAfter))
  );
}

function isMixedEndpoint(position: ResolvedPos): boolean {
  return position.parent.inlineContent || isStandaloneBoundary(position);
}

function isValidMixedPair(anchor: ResolvedPos, head: ResolvedPos): boolean {
  return (
    anchor.pos !== head.pos &&
    isMixedEndpoint(anchor) &&
    isMixedEndpoint(head) &&
    (isStandaloneBoundary(anchor) ||
      isStandaloneBoundary(head) ||
      rangeContainsStandaloneBlock(anchor.doc, anchor.pos, head.pos))
  );
}

function rangeContainsStandaloneBlock(document: ProseMirrorNode, anchor: number, head: number): boolean {
  const from = Math.min(anchor, head);
  const to = Math.max(anchor, head);
  let found = false;
  document.nodesBetween(from, to, (node, position) => {
    if (found) {
      return false;
    }
    if (isStandaloneBlock(node) && from <= position && to >= position + node.nodeSize) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

function textFallback(document: ProseMirrorNode, anchor: number, head: number): Selection {
  return TextSelection.between(document.resolve(anchor), document.resolve(head));
}

class BlockMixedSelectionBookmark implements SelectionBookmark {
  constructor(
    readonly anchor: number,
    readonly head: number,
  ) {}

  map(mapping: Mappable): SelectionBookmark {
    const forward = this.anchor < this.head;
    return new BlockMixedSelectionBookmark(
      mapping.map(this.anchor, forward ? -1 : 1),
      mapping.map(this.head, forward ? 1 : -1),
    );
  }

  resolve(document: ProseMirrorNode): Selection {
    return BlockMixedSelection.between(document, this.anchor, this.head);
  }
}

/**
 * A native-looking text range whose moving edge may stop between sibling
 * Blocks. ProseMirror TextSelection cannot keep such a structural endpoint,
 * while NodeRangeSelection discards a partial text anchor.
 */
export class BlockMixedSelection extends Selection {
  map(document: ProseMirrorNode, mapping: Mappable): Selection {
    const forward = this.anchor < this.head;
    const anchor = mapping.map(this.anchor, forward ? -1 : 1);
    const head = mapping.map(this.head, forward ? 1 : -1);
    return BlockMixedSelection.between(document, anchor, head);
  }

  eq(other: Selection): boolean {
    return other instanceof BlockMixedSelection && other.anchor === this.anchor && other.head === this.head;
  }

  toJSON(): { type: 'geulBlockMixed'; anchor: number; head: number } {
    return { type: 'geulBlockMixed', anchor: this.anchor, head: this.head };
  }

  getBookmark(): SelectionBookmark {
    return new BlockMixedSelectionBookmark(this.anchor, this.head);
  }

  static between(document: ProseMirrorNode, anchor: number, head: number): Selection {
    const $anchor = document.resolve(anchor);
    const $head = document.resolve(head);
    return isValidMixedPair($anchor, $head)
      ? new BlockMixedSelection($anchor, $head)
      : textFallback(document, anchor, head);
  }

  static create(document: ProseMirrorNode, anchor: number, head: number): BlockMixedSelection {
    const $anchor = document.resolve(anchor);
    const $head = document.resolve(head);
    if (!isValidMixedPair($anchor, $head)) {
      throw new RangeError('BlockMixedSelection must cross a complete standalone Block.');
    }
    return new BlockMixedSelection($anchor, $head);
  }

  static fromJSON(document: ProseMirrorNode, value: unknown): Selection {
    if (
      !value ||
      typeof value !== 'object' ||
      typeof (value as { anchor?: unknown }).anchor !== 'number' ||
      typeof (value as { head?: unknown }).head !== 'number'
    ) {
      throw new RangeError('Invalid BlockMixedSelection JSON.');
    }
    const { anchor, head } = value as { anchor: number; head: number };
    return BlockMixedSelection.between(document, anchor, head);
  }
}

export function isTextRangeSelection(selection: Selection): selection is TextSelection | BlockMixedSelection {
  return selection instanceof TextSelection || selection instanceof BlockMixedSelection;
}

try {
  Selection.jsonID('geulBlockMixed', BlockMixedSelection);
} catch {
  // Tiptap uses the same guard for selection modules loaded by both ESM and CJS.
}

function outerBoundary(block: BlockBoundary, direction: MixedSelectionDirection): number {
  return isForward(direction) ? block.position + block.node.nodeSize : block.position;
}

function edgeInlineSize(content: ProseMirrorNode, direction: MixedSelectionDirection): number {
  const inline = isForward(direction) ? content.firstChild : content.lastChild;
  if (!inline) {
    return 0;
  }
  if (!inline.isText) {
    return inline.nodeSize;
  }
  const text = inline.text ?? '';
  const segments = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text));
  const segment = isForward(direction) ? segments[0] : segments.at(-1);
  return segment?.segment.length ?? 0;
}

function textEdge(block: BlockBoundary, direction: MixedSelectionDirection): number | null {
  const content = block.node.firstChild;
  if (!content?.isTextblock) {
    return null;
  }
  const start = block.contentPosition + 1;
  const end = start + content.content.size;
  const inlineSize = edgeInlineSize(content, direction);
  return isForward(direction) ? start + inlineSize : end - inlineSize;
}

function textHead(block: BlockBoundary, direction: MixedSelectionDirection, anchor: number): number | null {
  const content = block.node.firstChild;
  if (!content?.isTextblock) {
    return null;
  }
  const start = block.contentPosition + 1;
  const end = start + content.content.size;
  return anchor >= start && anchor <= end ? anchor : textEdge(block, direction);
}

function crossBlock(editor: Editor, block: BlockBoundary, direction: MixedSelectionDirection): boolean {
  const content = block.node.firstChild;
  if (!content) {
    return false;
  }
  const { selection, doc } = editor.state;
  const head = isStandaloneBlockContent(content)
    ? outerBoundary(block, direction)
    : textHead(block, direction, selection.anchor);
  if (head === null || head === selection.head) {
    return false;
  }
  const next = BlockMixedSelection.between(doc, selection.anchor, head);
  editor.view.dispatch(editor.state.tr.setSelection(next).scrollIntoView());
  return true;
}

function siblingAtHead(selection: BlockMixedSelection, direction: MixedSelectionDirection): BlockBoundary | null {
  const $head = selection.$head;
  if ($head.parent.type.name !== 'blockGroup') {
    return null;
  }
  const index = $head.index() + (isForward(direction) ? 0 : -1);
  if (index < 0 || index >= $head.parent.childCount) {
    return null;
  }
  const node = $head.parent.child(index);
  let position = $head.start();
  for (let childIndex = 0; childIndex < index; childIndex += 1) {
    position += $head.parent.child(childIndex).nodeSize;
  }
  return {
    contentPosition: position + 1,
    groupDepth: $head.depth,
    node,
    position,
  };
}

function textSelectionCanCross(editor: Editor, selection: Selection, direction: MixedSelectionDirection): boolean {
  const forward = isForward(direction);
  if (!selection.$head.parent.isTextblock) {
    return false;
  }
  const atInlineEdge = forward
    ? selection.$head.parentOffset === selection.$head.parent.content.size
    : selection.$head.parentOffset === 0;
  if (direction === 'left' || direction === 'right') {
    return atInlineEdge;
  }
  return atInlineEdge || editor.view.endOfTextblock(direction);
}

export function handleMixedBlockSelection(editor: Editor, direction: MixedSelectionDirection): boolean {
  const { selection, doc } = editor.state;
  if (selection instanceof BlockMixedSelection) {
    const sibling = siblingAtHead(selection, direction);
    if (sibling) {
      return crossBlock(editor, sibling, direction);
    }
    if (!textSelectionCanCross(editor, selection, direction)) {
      return false;
    }
    const current = blockBoundaryAt(selection.$head);
    const target = current ? adjacentBlockBoundary(doc, current, isForward(direction) ? 'down' : 'up') : null;
    return target ? crossBlock(editor, target, direction) : false;
  }
  if (!(selection instanceof TextSelection) || !textSelectionCanCross(editor, selection, direction)) {
    return false;
  }
  const current = blockBoundaryAt(selection.$head);
  const target = current ? adjacentBlockBoundary(doc, current, isForward(direction) ? 'down' : 'up') : null;
  const content = target?.node.firstChild;
  return target && content && isStandaloneBlockContent(content) ? crossBlock(editor, target, direction) : false;
}

function canonicalEndpoint(position: ResolvedPos, counterpart: ResolvedPos): ResolvedPos | null {
  if (position.parent.inlineContent || isStandaloneBoundary(position)) {
    return position;
  }
  const block = blockBoundaryAt(position);
  if (!block || !isStandaloneBlock(block.node)) {
    return null;
  }
  const outerPosition = position.pos < counterpart.pos ? block.position : block.position + block.node.nodeSize;
  return position.doc.resolve(outerPosition);
}

export function createBlockMixedSelectionBetween(
  _view: EditorView,
  anchor: ResolvedPos,
  head: ResolvedPos,
): Selection | null {
  if (anchor.pos === head.pos) {
    return null;
  }
  const $anchor = canonicalEndpoint(anchor, head);
  const $head = canonicalEndpoint(head, anchor);
  if (!$anchor || !$head || !isValidMixedPair($anchor, $head)) {
    return null;
  }
  return new BlockMixedSelection($anchor, $head);
}

const NODE_RANGE_SELECTED = 'ProseMirror-selectednoderange';

function mixedBlockDecorations(state: EditorState): DecorationSet {
  const { selection } = state;
  if (!(selection instanceof BlockMixedSelection)) {
    return DecorationSet.empty;
  }
  const decorations: Decoration[] = [];
  state.doc.nodesBetween(selection.from, selection.to, (node, position) => {
    if (!isStandaloneBlock(node)) {
      return true;
    }
    if (selection.from <= position && selection.to >= position + node.nodeSize) {
      const content = node.firstChild;
      if (!content) {
        return false;
      }
      const contentPosition = position + 1;
      decorations.push(
        Decoration.node(contentPosition, contentPosition + content.nodeSize, {
          class: NODE_RANGE_SELECTED,
          'data-node-range-selected': 'true',
        }),
      );
    }
    return false;
  });
  return decorations.length > 0 ? DecorationSet.create(state.doc, decorations) : DecorationSet.empty;
}

export const BlockMixedSelectionExtension = Extension.create({
  name: 'blockMixedSelection',
  priority: 1250,
  addKeyboardShortcuts() {
    return {
      'Shift-ArrowRight': () => handleMixedBlockSelection(this.editor, 'right'),
      'Shift-ArrowLeft': () => handleMixedBlockSelection(this.editor, 'left'),
      'Shift-ArrowDown': () => handleMixedBlockSelection(this.editor, 'down'),
      'Shift-ArrowUp': () => handleMixedBlockSelection(this.editor, 'up'),
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          createSelectionBetween: createBlockMixedSelectionBetween,
          decorations: mixedBlockDecorations,
        },
      }),
    ];
  },
});
