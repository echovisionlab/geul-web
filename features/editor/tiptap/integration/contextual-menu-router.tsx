'use client';

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { CellSelection } from '@tiptap/pm/tables';
import { TiptapSelectionBubbleMenu, type SelectionBubbleMenuLabels } from '../menus';
import type { TiptapAIContext } from '../ai';
import { TiptapTableMenu } from '../table';

/** Exactly one text/table floating surface owns the current selection. */
export function TiptapContextualMenuRouter({
  editor,
  selectionLabels,
  onAIActivate,
  allowTableMenu = true,
}: {
  editor: Editor;
  selectionLabels: SelectionBubbleMenuLabels;
  onAIActivate?: (context: TiptapAIContext) => void;
  allowTableMenu?: boolean;
}) {
  const [, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((revision) => revision + 1);
    editor.on('selectionUpdate', refresh);
    editor.on('transaction', refresh);
    return () => {
      editor.off('selectionUpdate', refresh);
      editor.off('transaction', refresh);
    };
  }, [editor]);
  if (editor.state.selection instanceof CellSelection) {
    return allowTableMenu ? <TiptapTableMenu editor={editor} /> : null;
  }
  return <TiptapSelectionBubbleMenu editor={editor} labels={selectionLabels} onAIActivate={onAIActivate} />;
}
