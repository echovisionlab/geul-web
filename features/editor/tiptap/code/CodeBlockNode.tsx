'use client';

import { useCallback, useRef } from 'react';
import { NodeSelection } from '@tiptap/pm/state';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { redo, undo } from 'y-prosemirror';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { useBlockResize } from '@/features/editor/hooks/useBlockResize';
import { EditorMediaBlockFrame } from '@/features/editor/ui/EditorMediaBlockShell';
import { redoBlockRoomEditor, undoBlockRoomEditor } from '@/lib/collab/interactive-mutation-undo';
import {
  CODE_BLOCK_AUTHORING_LANGUAGES,
  codeBlockOptions,
  getCodeBlockLanguageName,
  resolveCodeBlockLanguage,
} from '@/lib/editor/code-block-options';
import { isMonacoSourceEditorEvent } from '../code-editor';
import { useTiptapEditorEditable } from '../useTiptapEditorEditable';
import { useExactTiptapNodeSelection } from '../useExactTiptapNodeSelection';
import { WireCodeBlock } from '../wire-schema';
import { replaceCodeBlockSource } from './code-source-transaction';
import { normalizeCodeBlockPreviewWidth, updateCodeBlockNeutralAttrsAtPosition } from './code-block-commands';
import { CodeBlockSurface } from './CodeBlockSurface';
import classes from './CodeBlockNode.module.css';

const editorInstanceScopes = new WeakMap<object, string>();
let nextEditorInstanceScope = 1;
const CODE_BLOCK_LANGUAGE_OPTIONS = CODE_BLOCK_AUTHORING_LANGUAGES.map((value) => ({
  value,
  label: codeBlockOptions.supportedLanguages[value].name,
}));

interface CodeSourceEditorRegistration {
  getPosition: () => number | undefined;
  sourceEditor: { focus: () => void };
}

const sourceEditors = new WeakMap<object, Set<CodeSourceEditorRegistration>>();

function registerCodeSourceEditor(
  editor: object,
  getPosition: CodeSourceEditorRegistration['getPosition'],
  sourceEditor: CodeSourceEditorRegistration['sourceEditor'],
) {
  const editors = sourceEditors.get(editor) ?? new Set<CodeSourceEditorRegistration>();
  const registration = { getPosition, sourceEditor };
  editors.add(registration);
  sourceEditors.set(editor, editors);
  return () => {
    editors.delete(registration);
    if (editors.size === 0) {
      sourceEditors.delete(editor);
    }
  };
}

export function focusSelectedCodeBlockSourceEditor(editor: NodeViewProps['editor'], position: number): boolean {
  for (const registration of sourceEditors.get(editor) ?? []) {
    if (registration.getPosition() === position) {
      registration.sourceEditor.focus();
      return true;
    }
  }
  return false;
}

export function codeEditorModelPath(editor: object, blockId: string, fileExtension: string): string {
  let scope = editorInstanceScopes.get(editor);
  if (!scope) {
    scope = `editor-${nextEditorInstanceScope}`;
    nextEditorInstanceScope += 1;
    editorInstanceScopes.set(editor, scope);
  }
  return `code/${scope}/${encodeURIComponent(blockId)}.${fileExtension}`;
}

function blockIdForPosition({ editor, getPos }: Pick<NodeViewProps, 'editor' | 'getPos'>): string {
  const position = getPos();
  if (typeof position !== 'number') {
    return 'detached';
  }
  const $position = editor.state.doc.resolve(position);
  const id = $position.parent.type.name === 'blockContainer' ? $position.parent.attrs.id : null;
  return typeof id === 'string' && id !== '' ? id : `position-${position}`;
}

export function selectCodeBlockAtPosition(
  editor: NodeViewProps['editor'],
  getPos: NodeViewProps['getPos'],
  focusEditor = true,
): boolean {
  if (!editor.isEditable) {
    return false;
  }
  const position = getPos();
  if (typeof position !== 'number') {
    return false;
  }
  const current = editor.state.selection;
  if (current instanceof NodeSelection && current.from === position && current.node.type.name === 'codeBlock') {
    if (focusEditor) {
      editor.view.focus();
    }
    return true;
  }
  editor.view.dispatch(
    editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, position)).setMeta('addToHistory', false),
  );
  if (focusEditor) {
    editor.view.focus();
  }
  return true;
}

function CodeBlockNodeView({
  editor,
  getPos,
  node,
  updateAttributes,
  authoringMode,
  labels,
}: NodeViewProps & {
  authoringMode: EditorAuthoringMode | null;
  labels: CodeBlockLabels;
}) {
  const editorEditable = useTiptapEditorEditable(editor);
  const exactNodeSelected = useExactTiptapNodeSelection({ editor, getPos });
  const canEditSource = editorEditable && authoringMode?.allowLocalizedBlockEdits === true;
  const canEditNeutral = editorEditable && authoringMode?.allowNeutralBlockEdits === true;
  const language = resolveCodeBlockLanguage(node.attrs.language);
  const languageName = getCodeBlockLanguageName(node.attrs.language);
  const title = typeof node.attrs.title === 'string' ? node.attrs.title : '';
  const alignment =
    node.attrs.textAlignment === 'center' || node.attrs.textAlignment === 'right' ? node.attrs.textAlignment : 'left';
  const previewWidth = normalizeCodeBlockPreviewWidth(node.attrs.previewWidth);
  const blockId = blockIdForPosition({ editor, getPos });
  const frameRef = useRef<HTMLDivElement>(null);
  const select = useCallback(() => {
    selectCodeBlockAtPosition(editor, getPos, false);
  }, [editor, getPos]);
  const updateSource = useCallback(
    (source: string) => {
      if (editor.isEditable && authoringMode?.allowLocalizedBlockEdits === true) {
        replaceCodeBlockSource({ editor, getPos, node }, source);
      }
    },
    [authoringMode, editor, getPos, node],
  );
  const exitSourceEditor = useCallback(() => {
    selectCodeBlockAtPosition(editor, getPos);
  }, [editor, getPos]);
  const persistPreviewWidth = useCallback(
    (width: number) => {
      const position = getPos();
      if (typeof position !== 'number') {
        return;
      }
      updateCodeBlockNeutralAttrsAtPosition({
        editor,
        position,
        blockId: blockId.startsWith('position-') || blockId === 'detached' ? '' : blockId,
        attributes: { previewWidth: normalizeCodeBlockPreviewWidth(width) },
        authoringMode,
      });
    },
    [authoringMode, blockId, editor, getPos],
  );
  const registerSourceEditor = useCallback(
    (sourceEditor: { focus: () => void }) =>
      registerCodeSourceEditor(
        editor,
        () => {
          const position = getPos();
          return typeof position === 'number' ? position : undefined;
        },
        sourceEditor,
      ),
    [editor, getPos],
  );
  const resize = useBlockResize({
    containerRef: frameRef,
    previewWidth,
    enabled: canEditNeutral && exactNodeSelected,
    onResize: persistPreviewWidth,
  });

  return (
    <NodeViewWrapper
      className={classes.node}
      data-content-type="codeBlock"
      data-language={language.durableLanguage}
      data-preview-width={previewWidth}
      data-text-alignment={alignment}
      data-selected={exactNodeSelected || undefined}
    >
      <EditorMediaBlockFrame
        className={classes.frame}
        containerRef={frameRef}
        widthPercent={resize.widthPercent}
        margin={resize.getMarginStyle(alignment)}
        allowResize={canEditNeutral && exactNodeSelected}
        suppressStaticTextSelection
        selected={exactNodeSelected}
        isResizing={resize.isDragging !== null}
        resizeMin={resize.minWidth}
        resizeMax={resize.maxWidth}
        resizeLeftLabel={labels.resizeLeft}
        resizeRightLabel={labels.resizeRight}
        onResizeLeftPointerDown={resize.startResizeLeft}
        onResizeRightPointerDown={resize.startResizeRight}
        onResizeLeftKeyDown={resize.onResizeKeyDown}
        onResizeRightKeyDown={resize.onResizeKeyDown}
        onResizeBlur={resize.onResizeBlur}
      >
        <button
          type="button"
          className={classes.selector}
          aria-label={labels.menu}
          tabIndex={editorEditable ? 0 : -1}
          contentEditable={false}
          onFocus={select}
          onClick={select}
        />
        <div
          className={classes.editor}
          contentEditable={false}
          onKeyDownCapture={(event) => {
            if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.stopPropagation();
              exitSourceEditor();
            }
          }}
        >
          <CodeBlockSurface
            title={title}
            fallbackTitle={labels.menu}
            titleLabel={labels.menu}
            languageName={languageName}
            languageLabel={canEditNeutral ? labels.language : undefined}
            languageValue={canEditNeutral ? language.durableLanguage : undefined}
            languageOptions={canEditNeutral ? CODE_BLOCK_LANGUAGE_OPTIONS : undefined}
            source={node.textContent}
            sourceLabel={labels.source}
            copyLabel={labels.copy}
            monacoLanguage={language.monacoLanguage}
            titleEditable={canEditSource}
            sourceReadOnly={!canEditSource}
            onTitleChange={(nextTitle) => updateAttributes({ title: nextTitle })}
            onLanguageChange={
              canEditNeutral ? (nextLanguage) => updateAttributes({ language: nextLanguage }) : undefined
            }
            onSourceChange={updateSource}
            onUndo={() => undoBlockRoomEditor(editor) || undo(editor.state)}
            onRedo={() => redoBlockRoomEditor(editor) || redo(editor.state)}
            onEscape={exitSourceEditor}
            modelPath={codeEditorModelPath(editor, blockId, language.fileExtension)}
            onMount={registerSourceEditor}
          />
        </div>
      </EditorMediaBlockFrame>
      <NodeViewContent className={classes.content} aria-hidden="true" />
    </NodeViewWrapper>
  );
}

export interface CodeBlockLabels {
  menu: string;
  source: string;
  copy: string;
  language: string;
  resizeLeft: string;
  resizeRight: string;
}

const DEFAULT_CODE_BLOCK_LABELS: CodeBlockLabels = {
  menu: 'Code block',
  source: 'Source',
  copy: 'Copy',
  language: 'Language',
  resizeLeft: 'Resize code block from left',
  resizeRight: 'Resize code block from right',
};

export function createTiptapCodeBlock(
  authoringMode: EditorAuthoringMode | null = null,
  labels: CodeBlockLabels = DEFAULT_CODE_BLOCK_LABELS,
) {
  return WireCodeBlock.extend<{ authoringMode: EditorAuthoringMode | null; labels: CodeBlockLabels }>({
    addOptions() {
      return { authoringMode, labels };
    },
    addNodeView() {
      const options = this.options;
      return ReactNodeViewRenderer(
        (props) => <CodeBlockNodeView {...props} authoringMode={options.authoringMode} labels={options.labels} />,
        {
          stopEvent: ({ event }) =>
            isMonacoSourceEditorEvent(event) ||
            (event.target instanceof Element && event.target.closest('[data-code-block-control]') !== null),
        },
      );
    },
  });
}

export { replaceCodeBlockSource } from './code-source-transaction';
