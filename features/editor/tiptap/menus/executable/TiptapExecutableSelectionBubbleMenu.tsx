'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { BubbleMenu } from '@tiptap/react/menus';
import { useTiptapBubbleMenu } from '../useSelectionToolbarNavigation';
import { ExecutableSelectionMenu } from './ExecutableSelectionMenu';
import {
  type ExecutableBlockType,
  type ExecutableSelectionMenuRegistry,
  useExecutableSelectionMenuRegistry,
} from './ExecutableSelectionMenuRegistry';

const EXECUTABLE_NODE_TYPES = new Set<ExecutableBlockType>(['p5Sketch', 'threeScene', 'shader']);
const EXECUTABLE_BUBBLE_OPTIONS = { placement: 'top', offset: 8, flip: true, shift: true } as const;

export function resolveSelectedExecutableBlock(
  editor: Editor,
): { blockId: string; blockType: ExecutableBlockType } | null {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) {
    return null;
  }
  let node = selection.node;
  let blockId = '';
  if (node.type.name === 'blockContainer') {
    blockId = typeof node.attrs.id === 'string' ? node.attrs.id : '';
    node = node.firstChild ?? node;
  } else if (EXECUTABLE_NODE_TYPES.has(node.type.name as ExecutableBlockType)) {
    const parent = selection.$from.parent;
    if (parent.type.name === 'blockContainer' && typeof parent.attrs.id === 'string') {
      blockId = parent.attrs.id;
    }
  }
  const blockType = node.type.name as ExecutableBlockType;
  return blockId && EXECUTABLE_NODE_TYPES.has(blockType) ? { blockId, blockType } : null;
}

export function TiptapExecutableSelectionBubbleMenu({
  editor,
  registry: suppliedRegistry,
}: {
  editor: Editor;
  registry?: ExecutableSelectionMenuRegistry;
}) {
  const contextualRegistry = useExecutableSelectionMenuRegistry();
  const registry = suppliedRegistry ?? contextualRegistry;
  const [, setRevision] = useState(0);
  const menu = useTiptapBubbleMenu(editor, 'tiptap-executable-selection-menu');
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    editor.on('transaction', refresh);
    editor.on('update', refresh);
    const unsubscribe = registry?.subscribe(refresh);
    return () => {
      editor.off('transaction', refresh);
      editor.off('update', refresh);
      unsubscribe?.();
    };
  }, [editor, registry]);
  const shouldShow = useCallback(
    ({ editor: current }: { editor: Editor }) => {
      const currentSelected = resolveSelectedExecutableBlock(current);
      return (
        !menu.isDismissed && current.isEditable && Boolean(currentSelected && registry?.get(currentSelected.blockId))
      );
    },
    [menu.isDismissed, registry],
  );
  const selected = resolveSelectedExecutableBlock(editor);
  const binding = selected && registry ? registry.get(selected.blockId) : undefined;
  if (menu.isDismissed || !editor.isEditable || !binding || !selected) {
    return null;
  }
  return (
    <BubbleMenu
      editor={editor}
      pluginKey={menu.pluginKey}
      updateDelay={0}
      shouldShow={shouldShow}
      options={EXECUTABLE_BUBBLE_OPTIONS}
    >
      <ExecutableSelectionMenu binding={binding} editorElement={editor.view.dom} onEscape={menu.hide} />
    </BubbleMenu>
  );
}
