import type { Editor } from '@tiptap/core';
import { NodeSelection, Selection } from '@tiptap/pm/state';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { resolveCodeBlockLanguage } from '@/lib/editor/code-block-options';
import type { ContextualBlockAlignment } from '../menus/map-external/AlignmentMenuActions';

export interface SelectedCodeBlock {
  blockId: string;
  position: number;
  source: string;
  language: string;
  previewWidth: string;
  textAlignment: ContextualBlockAlignment;
}

function normalizedLanguage(value: unknown): string {
  return resolveCodeBlockLanguage(value).durableLanguage;
}

function normalizedAlignment(value: unknown): ContextualBlockAlignment {
  return value === 'center' || value === 'right' ? value : 'left';
}

export function normalizeCodeBlockPreviewWidth(value: unknown): string {
  const width = typeof value === 'number' ? value : Number.parseInt(typeof value === 'string' ? value : '', 10);
  return String(Math.max(10, Math.min(100, Number.isFinite(width) ? Math.round(width) : 100)));
}

export function getSelectedCodeBlock(editor: Editor): SelectedCodeBlock | null {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) {
    return null;
  }
  const codeBlock =
    selection.node.type.name === 'codeBlock'
      ? selection.node
      : selection.node.type.name === 'blockContainer' && selection.node.firstChild?.type.name === 'codeBlock'
        ? selection.node.firstChild
        : null;
  if (!codeBlock) {
    return null;
  }
  const position = selection.node.type.name === 'codeBlock' ? selection.from : selection.from + 1;
  const parent = editor.state.doc.resolve(position).parent;
  const blockId = parent.type.name === 'blockContainer' && typeof parent.attrs.id === 'string' ? parent.attrs.id : '';
  return {
    blockId,
    position,
    source: codeBlock.textContent,
    language: normalizedLanguage(codeBlock.attrs.language),
    previewWidth: normalizeCodeBlockPreviewWidth(codeBlock.attrs.previewWidth),
    textAlignment: normalizedAlignment(codeBlock.attrs.textAlignment),
  };
}

type CodeBlockNeutralAttributes = Pick<SelectedCodeBlock, 'language' | 'previewWidth' | 'textAlignment'>;

function normalizeNeutralAttributes(
  attributes: Partial<CodeBlockNeutralAttributes>,
): Partial<CodeBlockNeutralAttributes> {
  return {
    ...(attributes.language === undefined ? {} : { language: normalizedLanguage(attributes.language) }),
    ...(attributes.previewWidth === undefined
      ? {}
      : { previewWidth: normalizeCodeBlockPreviewWidth(attributes.previewWidth) }),
    ...(attributes.textAlignment === undefined ? {} : { textAlignment: normalizedAlignment(attributes.textAlignment) }),
  };
}

export function updateCodeBlockNeutralAttrsAtPosition({
  editor,
  position,
  blockId,
  attributes,
  authoringMode,
  select = false,
}: {
  editor: Editor;
  position: number;
  blockId: string;
  attributes: Partial<CodeBlockNeutralAttributes>;
  authoringMode: EditorAuthoringMode | null;
  select?: boolean;
}): boolean {
  if (!editor.isEditable || authoringMode?.allowNeutralBlockEdits !== true) {
    return false;
  }
  const node = editor.state.doc.nodeAt(position);
  if (node?.type.name !== 'codeBlock') {
    return false;
  }
  const normalizedAttributes = normalizeNeutralAttributes(attributes);
  const transaction = editor.state.tr.setNodeMarkup(position, undefined, {
    ...node.attrs,
    ...normalizedAttributes,
  });
  if (select) {
    transaction.setSelection(NodeSelection.create(transaction.doc, position));
  }
  editor.view.dispatch(transaction.scrollIntoView());
  if (blockId) {
    authoringMode.applyNeutralBlockProps?.(blockId, normalizedAttributes);
  }
  return true;
}

export function updateSelectedCodeBlockAttrs(
  editor: Editor,
  attributes: Partial<CodeBlockNeutralAttributes>,
  authoringMode: EditorAuthoringMode | null,
): boolean {
  const selected = getSelectedCodeBlock(editor);
  if (!editor.isEditable || authoringMode?.allowNeutralBlockEdits !== true || !selected) {
    return false;
  }
  return updateCodeBlockNeutralAttrsAtPosition({
    editor,
    position: selected.position,
    blockId: selected.blockId,
    attributes,
    authoringMode,
    select: true,
  });
}

export function canDeleteSelectedCodeBlock(editor: Editor): boolean {
  const selected = getSelectedCodeBlock(editor);
  if (!selected) {
    return false;
  }
  const $position = editor.state.doc.resolve(selected.position);
  if ($position.parent.type.name !== 'blockContainer') {
    return false;
  }
  const containerDepth = $position.depth;
  const container = $position.node(containerDepth);
  const group = $position.node(containerDepth - 1);
  if (group.type.name !== 'blockGroup' || (group.childCount === 1 && containerDepth === 2)) {
    return false;
  }
  return container.type.name === 'blockContainer';
}

export function deleteSelectedCodeBlock(editor: Editor, authoringMode: EditorAuthoringMode | null): boolean {
  const selected = getSelectedCodeBlock(editor);
  if (
    !editor.isEditable ||
    authoringMode?.allowNeutralBlockEdits !== true ||
    !selected ||
    !canDeleteSelectedCodeBlock(editor)
  ) {
    return false;
  }
  const $position = editor.state.doc.resolve(selected.position);
  const containerDepth = $position.depth;
  const containerPosition = $position.before(containerDepth);
  const container = $position.node(containerDepth);
  const group = $position.node(containerDepth - 1);

  const transaction = editor.state.tr;
  if (group.childCount === 1) {
    transaction.delete($position.before(containerDepth - 1), $position.after(containerDepth - 1));
  } else {
    transaction.delete(containerPosition, containerPosition + container.nodeSize);
  }
  transaction.setSelection(
    Selection.near(transaction.doc.resolve(Math.min(containerPosition + 2, transaction.doc.content.size))),
  );
  editor.view.dispatch(transaction.scrollIntoView());
  if (selected.blockId) {
    authoringMode.deleteNeutralBlock?.(selected.blockId);
  }
  editor.commands.focus();
  return true;
}
