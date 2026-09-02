'use client';

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { BubbleMenu } from '@tiptap/react/menus';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { AlignmentMenuActions, type ContextualBlockAlignmentLabels } from '../menus/map-external/AlignmentMenuActions';
import { SelectionMenuAction, SelectionMenuSurface } from '../menus/map-external/SelectionMenuPrimitives';
import { useTiptapBubbleMenu } from '../menus/useSelectionToolbarNavigation';
import {
  canDeleteSelectedCodeBlock,
  deleteSelectedCodeBlock,
  getSelectedCodeBlock,
  updateSelectedCodeBlockAttrs,
} from './code-block-commands';
import { focusSelectedCodeBlockSourceEditor } from './CodeBlockNode';

const CODE_BLOCK_BUBBLE_OPTIONS = { placement: 'top', offset: 8, flip: true, shift: true } as const;
export interface CodeBlockSelectionMenuLabels extends ContextualBlockAlignmentLabels {
  menu: string;
  edit: string;
  source: string;
  language: string;
  languageNoResults: string;
  copy: string;
  delete: string;
  resizeLeft: string;
  resizeRight: string;
}

function shouldShowCodeBlockMenu({ editor }: { editor: Editor }): boolean {
  return (
    editor.isEditable &&
    editor.state.selection instanceof NodeSelection &&
    editor.state.selection.node.type.name === 'codeBlock' &&
    getSelectedCodeBlock(editor) !== null
  );
}

export function CodeBlockSelectionMenu({
  editor,
  authoringMode,
  labels,
}: {
  editor: Editor;
  authoringMode: EditorAuthoringMode | null;
  labels: CodeBlockSelectionMenuLabels;
}) {
  const [, setRevision] = useState(0);
  const menu = useTiptapBubbleMenu(editor, 'tiptap-code-block-menu');
  useEffect(() => {
    const refresh = () => setRevision((revision) => revision + 1);
    editor.on('selectionUpdate', refresh);
    editor.on('transaction', refresh);
    return () => {
      editor.off('selectionUpdate', refresh);
      editor.off('transaction', refresh);
    };
  }, [editor]);
  const selected =
    editor.state.selection instanceof NodeSelection && editor.state.selection.node.type.name === 'codeBlock'
      ? getSelectedCodeBlock(editor)
      : null;
  if (authoringMode?.allowNeutralBlockEdits !== true || !selected) {
    return null;
  }

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={menu.pluginKey}
      updateDelay={0}
      shouldShow={shouldShowCodeBlockMenu}
      options={CODE_BLOCK_BUBBLE_OPTIONS}
    >
      <SelectionMenuSurface
        label={labels.menu}
        testId="tiptap-code-block-menu"
        editorElement={editor.view.dom}
        navigationEnabled
        onEscape={menu.hide}
      >
        <SelectionMenuAction
          label={labels.edit}
          testId="tiptap-code-block-edit"
          onClick={() => {
            menu.hide();
            focusSelectedCodeBlockSourceEditor(editor, selected.position);
          }}
        >
          <IconEdit size={16} aria-hidden />
        </SelectionMenuAction>
        <AlignmentMenuActions
          value={selected.textAlignment}
          labels={labels}
          onChange={(textAlignment) => updateSelectedCodeBlockAttrs(editor, { textAlignment }, authoringMode)}
          testIdPrefix="tiptap-code-block-align"
        />
        <SelectionMenuAction
          label={labels.delete}
          tone="danger"
          testId="tiptap-code-block-delete"
          disabled={!canDeleteSelectedCodeBlock(editor)}
          onClick={() => deleteSelectedCodeBlock(editor, authoringMode)}
        >
          <IconTrash size={16} aria-hidden />
        </SelectionMenuAction>
      </SelectionMenuSurface>
    </BubbleMenu>
  );
}
