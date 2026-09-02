'use client';

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, type Selection } from '@tiptap/pm/state';
import { useEditorState, type NodeViewProps } from '@tiptap/react';

export function isExactTiptapNodeSelection(
  selection: Selection,
  position: number,
  node: ProseMirrorNode | null,
): boolean {
  return selection instanceof NodeSelection && selection.from === position && selection.node === node;
}

export function useExactTiptapNodeSelection({ editor, getPos }: Pick<NodeViewProps, 'editor' | 'getPos'>): boolean {
  return useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const position = getPos();
      const selection = current.state.selection;
      return (
        typeof position === 'number' &&
        isExactTiptapNodeSelection(selection, position, current.state.doc.nodeAt(position))
      );
    },
  });
}
