'use client';

import { IconTrash } from '@tabler/icons-react';
import { AlignmentMenuActions } from '../map-external/AlignmentMenuActions';
import { DisplaySizeMenuActions } from '../map-external/DisplaySizeMenuActions';
import { SelectionMenuAction, SelectionMenuSurface } from '../map-external/SelectionMenuPrimitives';
import type { ExecutableSelectionMenuBinding } from './ExecutableSelectionMenuRegistry';

export function ExecutableSelectionMenu({
  binding,
  editorElement,
  onEscape,
}: {
  binding: ExecutableSelectionMenuBinding;
  editorElement: HTMLElement;
  onEscape: () => void;
}) {
  const { snapshot, commands } = binding;
  const { labels } = snapshot;
  return (
    <SelectionMenuSurface
      label={labels.menu}
      testId={`tiptap-${snapshot.blockType}-menu`}
      editorElement={editorElement}
      navigationEnabled
      onEscape={onEscape}
    >
      <AlignmentMenuActions
        value={snapshot.textAlignment}
        labels={labels}
        disabled={snapshot.disabled}
        onChange={commands.setAlignment}
        testIdPrefix="tiptap-executable-align"
      />
      <DisplaySizeMenuActions
        value={snapshot.displaySize}
        labels={labels}
        disabled={snapshot.disabled}
        onChange={commands.setDisplaySize}
        testIdPrefix="tiptap-executable-size"
      />
      <SelectionMenuAction
        label={labels.deleteBlock}
        tone="danger"
        disabled={snapshot.disabled}
        onClick={commands.deleteBlock}
        testId="tiptap-executable-delete"
      >
        <IconTrash size={16} aria-hidden />
      </SelectionMenuAction>
    </SelectionMenuSurface>
  );
}
