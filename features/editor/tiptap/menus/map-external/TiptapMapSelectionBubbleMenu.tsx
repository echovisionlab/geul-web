'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { BubbleMenu } from '@tiptap/react/menus';
import { useTiptapBubbleMenu } from '../useSelectionToolbarNavigation';
import { MapSelectionMenu, type MapSelectionMenuLabels } from './MapSelectionMenu';
import { type TiptapMapSelectionMenuRegistry, useTiptapMapSelectionMenuRegistry } from './MapSelectionMenuRegistry';

const MAP_BUBBLE_OPTIONS = { placement: 'top', offset: 8, flip: true, shift: true } as const;

export function resolveSelectedTiptapMapBlockId(editor: Editor): string | null {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) {
    return null;
  }

  if (selection.node.type.name === 'blockContainer' && selection.node.firstChild?.type.name === 'map') {
    return typeof selection.node.attrs.id === 'string' && selection.node.attrs.id ? selection.node.attrs.id : null;
  }
  if (selection.node.type.name !== 'map') {
    return null;
  }

  const parent = selection.$from.parent;
  return parent.type.name === 'blockContainer' && typeof parent.attrs.id === 'string' && parent.attrs.id
    ? parent.attrs.id
    : null;
}

export interface TiptapMapSelectionBubbleMenuProps {
  editor: Editor;
  labels: MapSelectionMenuLabels;
  /** Explicit injection is useful when the editor and menu do not share one React provider tree. */
  registry?: TiptapMapSelectionMenuRegistry;
}

/** Mount-ready menu adapter. Map-private actions remain owned by the registered NodeView port. */
export function TiptapMapSelectionBubbleMenu({
  editor,
  labels,
  registry: suppliedRegistry,
}: TiptapMapSelectionBubbleMenuProps) {
  const contextualRegistry = useTiptapMapSelectionMenuRegistry();
  const registry = suppliedRegistry ?? contextualRegistry;
  const [, setRevision] = useState(0);
  const menu = useTiptapBubbleMenu(editor, 'tiptap-map-selection-menu');

  useEffect(() => {
    const refresh = () => setRevision((revision) => revision + 1);
    editor.on('transaction', refresh);
    const unsubscribe = registry?.subscribe(refresh);
    return () => {
      editor.off('transaction', refresh);
      unsubscribe?.();
    };
  }, [editor, registry]);

  const shouldShow = useCallback(
    ({ editor: current }: { editor: Editor }) => {
      const selectedBlockId = resolveSelectedTiptapMapBlockId(current);
      return !menu.isDismissed && current.isEditable && Boolean(selectedBlockId && registry?.get(selectedBlockId));
    },
    [menu.isDismissed, registry],
  );

  const blockId = resolveSelectedTiptapMapBlockId(editor);
  const binding = blockId && registry ? registry.get(blockId) : undefined;
  if (menu.isDismissed || !editor.isEditable || !blockId || !binding) {
    return null;
  }

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={menu.pluginKey}
      updateDelay={0}
      shouldShow={shouldShow}
      options={MAP_BUBBLE_OPTIONS}
    >
      <MapSelectionMenu
        labels={labels}
        places={binding.snapshot.places}
        textAlignment={binding.snapshot.textAlignment}
        previewWidth={binding.snapshot.previewWidth}
        editorElement={editor.view.dom}
        navigationEnabled
        isResizing={binding.snapshot.isResizing}
        disabled={binding.snapshot.disabled}
        onAddPlace={binding.commands.openPlaceManager}
        onRemovePlace={binding.commands.removePlace}
        onCenterPlace={binding.commands.centerPlace}
        onChangeAlignment={binding.commands.changeAlignment}
        onFocusCaption={binding.commands.focusCaption}
        onDelete={binding.commands.deleteBlock}
        onEscape={menu.hide}
      />
    </BubbleMenu>
  );
}
