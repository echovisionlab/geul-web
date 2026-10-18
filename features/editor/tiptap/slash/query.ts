import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import type { TiptapSlashRange } from './types';

interface TiptapSlashQuery extends TiptapSlashRange {
  query: string;
}

function slashQueryAfterInlineNode(parent: ProseMirrorNode, parentOffset: number): string | null {
  let previousNode: ProseMirrorNode | null = null;
  let query: string | null = null;
  parent.forEach((child, childOffset) => {
    const cursorOffset = parentOffset - childOffset;
    if (
      query === null &&
      previousNode?.isInline &&
      !previousNode.isText &&
      child.isText &&
      cursorOffset >= 0 &&
      cursorOffset <= child.nodeSize
    ) {
      query = /^\/([^\s/]*)$/u.exec(child.text?.slice(0, cursorOffset) ?? '')?.[1] ?? null;
    }
    previousNode = child;
  });
  return query;
}

export function getTiptapSlashQuery(state: EditorState, editable: boolean): TiptapSlashQuery | null {
  if (!editable || !state.selection.empty) {
    return null;
  }
  const { $from, from } = state.selection;
  if (!$from.parent.isTextblock) {
    return null;
  }
  const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n');
  const query =
    /(?:^|\s)\/([^\s/]*)$/u.exec(textBeforeCursor)?.[1] ?? slashQueryAfterInlineNode($from.parent, $from.parentOffset);
  if (query === null) {
    return null;
  }
  // Inline nodes and their source text do not map one-to-one onto document
  // positions, so measure the trigger backwards from the actual cursor.
  const slashFrom = from - (query.length + 1);
  const contentPosition = $from.before($from.depth);
  const blockId = String($from.node($from.depth - 1).attrs.id ?? '');
  return {
    query: query.toLocaleLowerCase(),
    from: slashFrom,
    to: from,
    contentPosition,
    blockId,
  };
}
