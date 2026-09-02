import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/core';

/** Applies a source edit as the smallest text replacement in ProseMirror. */
export function replaceCodeBlockSource(
  {
    editor,
    getPos,
    node,
  }: {
    editor: Editor;
    getPos: () => number | undefined;
    node: ProseMirrorNode;
  },
  nextSource: string,
): boolean {
  const position = getPos();
  if (!editor.isEditable || typeof position !== 'number') {
    return false;
  }
  const currentNode = editor.state.doc.nodeAt(position);
  if (!currentNode || currentNode.type !== node.type || nextSource === currentNode.textContent) {
    return false;
  }
  const previous = currentNode.textContent;
  let prefix = 0;
  while (prefix < previous.length && prefix < nextSource.length && previous[prefix] === nextSource[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < previous.length - prefix &&
    suffix < nextSource.length - prefix &&
    previous[previous.length - suffix - 1] === nextSource[nextSource.length - suffix - 1]
  ) {
    suffix += 1;
  }

  const replacement = nextSource.slice(prefix, nextSource.length - suffix);
  const from = position + 1 + prefix;
  const to = position + 1 + previous.length - suffix;
  const fragment = replacement ? Fragment.from(editor.schema.text(replacement)) : Fragment.empty;
  editor.view.dispatch(editor.state.tr.replaceWith(from, to, fragment));
  return true;
}
