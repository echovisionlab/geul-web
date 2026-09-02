'use client';

import { resolveEditorAuthoringMode } from '../EditorAuthoringMode';

export type EditorColorStyleKey = 'textColor' | 'backgroundColor';

interface ColorableBlock {
  id: string;
  props: Record<string, unknown>;
}

interface ColorableSelection<TBlock extends ColorableBlock> {
  blocks?: TBlock[];
}

interface ColorableEditor<TBlock extends ColorableBlock = ColorableBlock> {
  getSelection?: () => ColorableSelection<TBlock> | undefined;
  getTextCursorPosition: () => { block: TBlock };
  addStyles: (styles: Record<string, string>) => void;
  removeStyles: (styles: Record<string, string>) => void;
  updateBlock: (block: TBlock, update: { props: Record<string, unknown> }) => void;
}

function getTargetBlocks<TBlock extends ColorableBlock>(editor: ColorableEditor<TBlock>): TBlock[] {
  const selectedBlocks = editor.getSelection?.()?.blocks;
  if (selectedBlocks && selectedBlocks.length > 0) {
    return selectedBlocks;
  }

  const cursorBlock = editor.getTextCursorPosition().block;
  return cursorBlock ? [cursorBlock] : [];
}

function clearDefaultBlockStyle<TBlock extends ColorableBlock>(
  editor: ColorableEditor<TBlock>,
  styleKey: EditorColorStyleKey,
) {
  const authoringMode = resolveEditorAuthoringMode(editor as object);
  if (!authoringMode.allowNeutralBlockEdits) {
    return;
  }

  for (const block of getTargetBlocks(editor)) {
    const currentValue = block.props?.[styleKey];
    if (typeof currentValue !== 'string' || currentValue === 'default') {
      continue;
    }

    const nextProps = { [styleKey]: 'default' };
    editor.updateBlock(block, { props: nextProps });
    authoringMode.applyNeutralBlockProps?.(block.id, nextProps);
  }
}

export function applyEditorColorStyleChange<TBlock extends ColorableBlock>(
  editor: ColorableEditor<TBlock>,
  styleKey: EditorColorStyleKey,
  color: string,
) {
  if (color === 'default') {
    editor.removeStyles({ [styleKey]: color });
    clearDefaultBlockStyle(editor, styleKey);
    return;
  }

  editor.addStyles({ [styleKey]: color });
}
