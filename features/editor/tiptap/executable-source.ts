import { Fragment } from '@tiptap/pm/model';
import type { NodeViewProps } from '@tiptap/react';

/** Applies an executable-source edit as the smallest text replacement in ProseMirror/Yjs. */
export function replaceExecutableSource(
  { editor, getPos, node }: Pick<NodeViewProps, 'editor' | 'getPos' | 'node'>,
  nextSource: string,
): boolean {
  const position = getPos();
  if (!editor.isEditable || typeof position !== 'number') {
    return false;
  }
  const currentNode = editor.state.doc.nodeAt(position);
  if (!currentNode || currentNode.type !== node.type || currentNode.type.name !== node.type.name) {
    return false;
  }
  const previous = currentNode.textContent;
  if (nextSource === previous) {
    return false;
  }
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

export function executableBlockIdForPosition({ editor, getPos }: Pick<NodeViewProps, 'editor' | 'getPos'>): string {
  const position = getPos();
  if (typeof position !== 'number') {
    return 'detached';
  }
  const $position = editor.state.doc.resolve(position);
  const id = $position.parent.type.name === 'blockContainer' ? $position.parent.attrs.id : null;
  return typeof id === 'string' && id !== '' ? id : `position-${position}`;
}
