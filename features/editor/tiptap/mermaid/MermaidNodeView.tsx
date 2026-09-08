'use client';

import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { undo, redo, yUndoPluginKey } from 'y-prosemirror';
import { undoBlockRoomEditor, redoBlockRoomEditor } from '@/lib/collab/interactive-mutation-undo';
import { MermaidDiagram } from '@/features/mermaid/MermaidDiagram';
import { MermaidEditor } from '@/features/mermaid/MermaidEditor';
import { focusParagraphAfterSelectedBlock } from '../block-commands';
import { executableBlockIdForPosition, replaceExecutableSource } from '../executable-source';
import { useTiptapEditorEditable } from '../useTiptapEditorEditable';
import { useExactTiptapNodeSelection } from '../useExactTiptapNodeSelection';
import type { MermaidNodeOptions } from './mermaid-extension';

export function MermaidNodeView({
  editor,
  getPos,
  node,
  updateAttributes,
  authoringMode,
}: NodeViewProps & MermaidNodeOptions) {
  const editable = useTiptapEditorEditable(editor);
  const selected = useExactTiptapNodeSelection({ editor, getPos });
  const canEditSource = editable && authoringMode?.allowNeutralBlockEdits === true;
  const canEditTitle = editable && authoringMode?.allowLocalizedBlockEdits === true;
  const source = node.textContent;
  const title = typeof node.attrs.title === 'string' ? node.attrs.title : '';
  const editing = selected && (canEditSource || canEditTitle);
  return (
    <NodeViewWrapper data-content-type="mermaid" contentEditable={false}>
      <div
        role={!editing && (canEditSource || canEditTitle) ? 'button' : undefined}
        aria-label={!editing ? 'Mermaid' : undefined}
        tabIndex={!editing && (canEditSource || canEditTitle) ? 0 : undefined}
        onKeyDown={(event) => {
          if (editing || (!canEditSource && !canEditTitle) || (event.key !== 'Enter' && event.key !== ' ')) {
            return;
          }
          const position = getPos();
          if (typeof position === 'number') {
            event.preventDefault();
            editor.commands.setNodeSelection(position);
          }
        }}
        onMouseDownCapture={(event) => {
          if (!editable || selected) {
            return;
          }
          const position = getPos();
          if (typeof position === 'number') {
            event.preventDefault();
            editor.commands.setNodeSelection(position);
          }
        }}
      >
        {editing ? (
          <MermaidEditor
            source={source}
            autoFocus
            title={title}
            modelPath={`tiptap/mermaid/${executableBlockIdForPosition({ editor, getPos })}.mmd`}
            onChange={
              canEditSource
                ? (next) => {
                    replaceExecutableSource({ editor, getPos, node }, next);
                  }
                : undefined
            }
            onTitleChange={canEditTitle ? (next) => updateAttributes({ title: next }) : undefined}
            onCaptionExit={() => focusParagraphAfterSelectedBlock(editor, canEditSource)}
            onUndo={() => {
              if (!undoBlockRoomEditor(editor) && !editor.commands.undo?.() && yUndoPluginKey.getState(editor.state)) {
                undo(editor.state);
              }
            }}
            onRedo={() => {
              if (!redoBlockRoomEditor(editor) && !editor.commands.redo?.() && yUndoPluginKey.getState(editor.state)) {
                redo(editor.state);
              }
            }}
            onEscape={() => {
              editor.commands.focus();
            }}
          />
        ) : (
          <MermaidDiagram source={source} title={title} />
        )}
      </div>
      <NodeViewContent style={{ display: 'none' }} />
    </NodeViewWrapper>
  );
}
