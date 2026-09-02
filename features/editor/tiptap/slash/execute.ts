import type { Editor } from '@tiptap/core';
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, TextSelection, type Transaction } from '@tiptap/pm/state';
import { createBlockId } from '@/lib/editor/block-id';
import { createTableNode } from '../table/table-commands';
import type {
  TiptapSlashActionContext,
  TiptapSlashExecutionResult,
  TiptapSlashIntrinsicExecution,
  TiptapSlashItem,
  TiptapSlashRange,
  TiptapSlashWorkflowCallbacks,
} from './types';

interface CurrentSlashAnchor {
  readonly contentNode: ProseMirrorNode;
  readonly contentFrom: number;
  readonly contentTo: number;
  readonly containerNode: ProseMirrorNode;
  readonly containerPosition: number;
  readonly triggerText: string;
  readonly replaceCurrentBlock: boolean;
}

interface LocatedBlock {
  readonly containerNode: ProseMirrorNode;
  readonly containerPosition: number;
  readonly contentNode: ProseMirrorNode;
  readonly contentPosition: number;
}

function childEndingAt(parent: ProseMirrorNode, offset: number): ProseMirrorNode | null {
  let result: ProseMirrorNode | null = null;
  parent.forEach((child, childOffset) => {
    if (childOffset + child.nodeSize === offset) {
      result = child;
    }
  });
  return result;
}

function resolveSlashAnchor(
  editor: Editor,
  range: TiptapSlashRange,
  requireCurrentSelection: boolean,
): CurrentSlashAnchor | null {
  const contentNode = editor.state.doc.nodeAt(range.contentPosition);
  if (!contentNode || !range.blockId || range.from > range.to) {
    return null;
  }

  const resolved = editor.state.doc.resolve(range.contentPosition);
  let containerNode: ProseMirrorNode | null = null;
  let containerPosition = -1;
  for (let depth = resolved.depth; depth >= 0; depth -= 1) {
    if (resolved.node(depth).type.name === 'blockContainer') {
      containerNode = resolved.node(depth);
      containerPosition = resolved.before(depth);
      break;
    }
  }

  const contentFrom = range.contentPosition + 1;
  const contentTo = range.contentPosition + contentNode.nodeSize - 1;
  if (
    !containerNode ||
    String(containerNode.attrs.id ?? '') !== range.blockId ||
    range.from < contentFrom ||
    range.to > contentTo ||
    (requireCurrentSelection && (!editor.state.selection.empty || editor.state.selection.from !== range.to))
  ) {
    return null;
  }

  const triggerText = editor.state.doc.textBetween(range.from, range.to, '', '');
  if (!/^\/[^\s/]*$/u.test(triggerText)) {
    return null;
  }
  if (range.from > contentFrom) {
    const boundaryNode = childEndingAt(contentNode, range.from - contentFrom);
    const boundary = editor.state.doc.textBetween(range.from - 1, range.from, '\n', '\n');
    if (
      !/\s/u.test(boundary) &&
      boundaryNode?.type.name !== 'hardBreak' &&
      !(boundaryNode?.isInline && !boundaryNode.isText)
    ) {
      return null;
    }
  }

  const replaceCurrentBlock = range.from === contentFrom && range.to === contentTo;

  return {
    contentNode,
    contentFrom,
    contentTo,
    containerNode,
    containerPosition,
    triggerText,
    replaceCurrentBlock,
  };
}

export function resolveCurrentSlashAnchor(editor: Editor, range: TiptapSlashRange): CurrentSlashAnchor | null {
  return resolveSlashAnchor(editor, range, true);
}

function findBlockById(editor: Editor, blockId: string): LocatedBlock | null {
  let result: LocatedBlock | null = null;
  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== 'blockContainer' || String(node.attrs.id ?? '') !== blockId) {
      return true;
    }
    const contentNode = node.firstChild;
    if (contentNode) {
      result = {
        containerNode: node,
        containerPosition: position,
        contentNode,
        contentPosition: position + 1,
      };
    }
    return false;
  });
  return result;
}

function currentFallbackInsertPosition(editor: Editor): number | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'blockContainer') {
      return $from.before(depth) + $from.node(depth).nodeSize;
    }
  }
  const blockGroup = editor.state.doc.firstChild;
  return blockGroup?.type.name === 'blockGroup' ? 1 + blockGroup.content.size : null;
}

function targetBlockIdIsAvailable(editor: Editor, targetBlockId: string): boolean {
  return findBlockById(editor, targetBlockId) === null;
}

function createSlashActionContext(range: TiptapSlashRange, anchor: CurrentSlashAnchor): TiptapSlashActionContext {
  const placement = anchor.replaceCurrentBlock ? 'replace' : 'after';
  return Object.freeze({
    blockId: range.blockId,
    targetBlockId: placement === 'replace' ? range.blockId : createBlockId(),
    placement,
    triggerText: anchor.triggerText,
    anchorContentJSON: JSON.stringify(anchor.contentNode.toJSON()),
    range: Object.freeze({ ...range }),
  });
}

/**
 * Applies one successful slash workflow at its exact captured anchor. A
 * slash-only block keeps its durable ID. A prefixed block keeps its existing
 * content and ID, and receives the result as its immediate next sibling.
 */
export function applyTiptapSlashContent(
  editor: Editor,
  context: TiptapSlashActionContext,
  contentNode: ProseMirrorNode,
  {
    trailingContent,
    selection = { type: 'node', offset: 0 },
    configureTransaction,
  }: {
    trailingContent?: ProseMirrorNode;
    selection?: { readonly type: 'node' | 'text'; readonly offset: number };
    configureTransaction?: (transaction: Transaction) => Transaction;
  } = {},
): number | null {
  const located = findBlockById(editor, context.blockId);
  const relativeFrom = context.range.from - context.range.contentPosition;
  const relativeTo = context.range.to - context.range.contentPosition;
  const currentRange = located
    ? {
        from: located.contentPosition + relativeFrom,
        to: located.contentPosition + relativeTo,
        contentPosition: located.contentPosition,
        blockId: context.blockId,
      }
    : null;
  const anchor = currentRange ? resolveSlashAnchor(editor, currentRange, false) : null;
  const expectedPlacement = anchor?.replaceCurrentBlock ? 'replace' : 'after';
  if (
    !editor.isEditable ||
    context.blockId !== context.range.blockId ||
    (context.placement === 'replace' && context.targetBlockId !== context.blockId) ||
    (context.placement === 'after' && context.targetBlockId === context.blockId) ||
    !context.targetBlockId
  ) {
    return null;
  }

  if (!located) {
    const insertAt = currentFallbackInsertPosition(editor);
    const blockContainer = editor.schema.nodes.blockContainer;
    if (!blockContainer || insertAt === null || !targetBlockIdIsAvailable(editor, context.targetBlockId)) {
      return null;
    }
    const content = trailingContent ? Fragment.fromArray([contentNode, trailingContent]) : contentNode;
    let transaction = editor.state.tr.insert(
      insertAt,
      blockContainer.createChecked({ id: context.targetBlockId }, content),
    );
    const selectionPosition = insertAt + 1 + selection.offset;
    transaction = transaction.setSelection(
      selection.type === 'text'
        ? TextSelection.create(transaction.doc, selectionPosition)
        : NodeSelection.create(transaction.doc, selectionPosition),
    );
    editor.view.dispatch((configureTransaction?.(transaction) ?? transaction).scrollIntoView());
    return insertAt + 1;
  }

  if (
    !anchor ||
    !currentRange ||
    context.placement !== expectedPlacement ||
    context.triggerText !== anchor.triggerText ||
    context.anchorContentJSON !== JSON.stringify(located.contentNode.toJSON()) ||
    (context.placement === 'after' && !targetBlockIdIsAvailable(editor, context.targetBlockId))
  ) {
    return null;
  }

  const deleteFrom = context.placement === 'replace' ? anchor.contentFrom : currentRange.from;
  const deleteTo = context.placement === 'replace' ? anchor.contentTo : currentRange.to;
  const transaction = editor.state.tr.delete(deleteFrom, deleteTo);
  const contentPosition = transaction.mapping.map(currentRange.contentPosition);
  const mappedContent = transaction.doc.nodeAt(contentPosition);
  if (!mappedContent) {
    return null;
  }

  let insertedContentPosition: number;
  if (context.placement === 'replace') {
    const content = trailingContent ? Fragment.fromArray([contentNode, trailingContent]) : contentNode;
    transaction.replaceWith(contentPosition, contentPosition + mappedContent.nodeSize, content);
    insertedContentPosition = contentPosition;
  } else {
    const blockContainer = editor.schema.nodes.blockContainer;
    if (!blockContainer) {
      return null;
    }
    const insertAt = transaction.mapping.map(anchor.containerPosition + anchor.containerNode.nodeSize);
    const content = trailingContent ? Fragment.fromArray([contentNode, trailingContent]) : contentNode;
    const insertedContainer = blockContainer.createChecked({ id: context.targetBlockId }, content);
    transaction.insert(insertAt, insertedContainer);
    insertedContentPosition = insertAt + 1;
  }

  const selectionPosition = insertedContentPosition + selection.offset;
  transaction.setSelection(
    selection.type === 'text'
      ? TextSelection.create(transaction.doc, selectionPosition)
      : NodeSelection.create(transaction.doc, selectionPosition),
  );
  editor.view.dispatch((configureTransaction?.(transaction) ?? transaction).scrollIntoView());
  return insertedContentPosition;
}

/** Applies a delayed Emoji extension result at the captured Slash query. */
export function applyTiptapSlashEmoji(editor: Editor, context: TiptapSlashActionContext, name: string): boolean {
  const emoji = editor.schema.nodes.emoji?.create({ name });
  if (!editor.isEditable || !emoji) {
    return false;
  }
  const located = findBlockById(editor, context.blockId);
  if (!located) {
    const selection = editor.state.selection;
    if (!(selection instanceof TextSelection) || !selection.$from.parent.inlineContent) {
      return false;
    }
    editor.view.dispatch(editor.state.tr.replaceWith(selection.from, selection.to, emoji).scrollIntoView());
    return true;
  }
  const relativeFrom = context.range.from - context.range.contentPosition;
  const relativeTo = context.range.to - context.range.contentPosition;
  const currentRange = {
    from: located.contentPosition + relativeFrom,
    to: located.contentPosition + relativeTo,
    contentPosition: located.contentPosition,
    blockId: context.blockId,
  };
  const anchor = resolveSlashAnchor(editor, currentRange, false);
  if (
    !anchor ||
    context.triggerText !== anchor.triggerText ||
    context.anchorContentJSON !== JSON.stringify(located.contentNode.toJSON())
  ) {
    return false;
  }
  editor.view.dispatch(editor.state.tr.replaceWith(currentRange.from, currentRange.to, emoji).scrollIntoView());
  return true;
}

function createDefaultTableNode(editor: Editor): ProseMirrorNode | null {
  return createTableNode(editor, {
    rows: 2,
    columns: 3,
    withHeaderRow: false,
    withHeaderColumn: false,
  });
}

function createIntrinsicNode(editor: Editor, execution: TiptapSlashIntrinsicExecution): ProseMirrorNode | null {
  if (execution.nodeName === 'table') {
    return createDefaultTableNode(editor);
  }
  const nodeType = editor.schema.nodes[execution.nodeName];
  return nodeType?.create(execution.attributes) ?? null;
}

function applyIntrinsicSlashItem(
  editor: Editor,
  item: TiptapSlashItem,
  context: TiptapSlashActionContext,
): TiptapSlashExecutionResult {
  if (item.execution.type !== 'intrinsic' || !editor.isEditable) {
    return { status: 'invalid' };
  }

  const { range } = context;
  const currentNode = editor.state.doc.nodeAt(range.contentPosition);
  const nodeType = editor.schema.nodes[item.execution.nodeName];
  if (!currentNode || !nodeType) {
    return { status: 'invalid' };
  }

  if (item.execution.nodeName === 'mathInline') {
    const transaction = editor.state.tr.delete(range.from, range.to);
    const insertionPosition = transaction.mapping.map(range.from);
    const inlineNode = createIntrinsicNode(editor, item.execution);
    if (!inlineNode) {
      return { status: 'invalid' };
    }
    transaction.insert(insertionPosition, inlineNode);
    transaction.setSelection(TextSelection.create(transaction.doc, insertionPosition + 1));
    editor.view.dispatch(transaction.scrollIntoView());
    return { status: 'applied', editorMutations: 1 };
  }

  if (context.placement === 'after') {
    const intrinsicNode = createIntrinsicNode(editor, item.execution);
    if (!intrinsicNode) {
      return { status: 'invalid' };
    }
    const insertedPosition = applyTiptapSlashContent(editor, context, intrinsicNode, {
      selection: item.execution.nodeName === 'callout' ? { type: 'text', offset: 1 } : undefined,
    });
    return insertedPosition === null ? { status: 'invalid' } : { status: 'applied', editorMutations: 1 };
  }

  const anchor = resolveCurrentSlashAnchor(editor, range);
  if (!anchor) {
    return { status: 'invalid' };
  }
  const deleteFrom = context.placement === 'replace' ? anchor.contentFrom : range.from;
  const deleteTo = context.placement === 'replace' ? anchor.contentTo : range.to;
  const transaction = editor.state.tr.delete(deleteFrom, deleteTo);
  const contentPosition = transaction.mapping.map(range.contentPosition);
  const contentNode = transaction.doc.nodeAt(contentPosition);
  if (!contentNode) {
    return { status: 'invalid' };
  }

  if (['divider', 'math', 'table'].includes(item.execution.nodeName)) {
    const replacement = createIntrinsicNode(editor, item.execution);
    if (!replacement) {
      return { status: 'invalid' };
    }
    transaction.replaceWith(contentPosition, contentPosition + contentNode.nodeSize, replacement);
    transaction.setSelection(NodeSelection.create(transaction.doc, contentPosition));
  } else {
    if (!nodeType.validContent(contentNode.content)) {
      return { status: 'invalid' };
    }
    transaction.setNodeMarkup(contentPosition, nodeType, item.execution.attributes);
  }

  editor.view.dispatch(transaction.scrollIntoView());
  return { status: 'applied', editorMutations: 1 };
}

/**
 * Executes exactly one slash choice. Intrinsic items dispatch one editor
 * transaction. A synchronous internal workflow may apply that one mutation;
 * a delegated modal performs zero mutations here and owns exactly one later
 * success insertion while cancel remains a no-op.
 */
export function executeTiptapSlashItem({
  editor,
  item,
  range,
  callbacks = {},
}: {
  editor: Editor;
  item: TiptapSlashItem;
  range: TiptapSlashRange;
  callbacks?: TiptapSlashWorkflowCallbacks;
}): TiptapSlashExecutionResult {
  if (!item.enabled) {
    return { status: 'unavailable' };
  }
  const anchor = resolveCurrentSlashAnchor(editor, range);
  if (!anchor) {
    return { status: 'invalid' };
  }
  const context = createSlashActionContext(range, anchor);
  if (item.execution.type === 'intrinsic') {
    return applyIntrinsicSlashItem(editor, item, context);
  }

  const callback = callbacks[item.execution.workflow];
  if (!callback) {
    return { status: 'unavailable' };
  }
  const applied = callback(context);
  if (applied === true) {
    return { status: 'applied', editorMutations: 1 };
  }
  return applied === false
    ? { status: 'invalid' }
    : { status: 'delegated', editorMutations: 0, workflow: item.execution.workflow };
}
