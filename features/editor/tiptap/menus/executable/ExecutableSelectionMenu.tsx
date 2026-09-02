'use client';

import { IconCode, IconEye, IconPlayerPlay, IconPlayerStop, IconRefresh, IconTrash } from '@tabler/icons-react';
import { AlignmentMenuActions } from '../map-external/AlignmentMenuActions';
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
      <SelectionMenuAction
        label={labels.edit}
        pressed={snapshot.mode === 'edit'}
        disabled={snapshot.disabled}
        onClick={() => commands.setMode('edit')}
        testId="tiptap-executable-edit"
      >
        <IconCode size={16} aria-hidden />
      </SelectionMenuAction>
      <SelectionMenuAction
        label={labels.source}
        pressed={snapshot.mode === 'source'}
        disabled={snapshot.disabled}
        onClick={() => commands.setMode('source')}
        testId="tiptap-executable-source"
      >
        <IconCode size={16} aria-hidden />
      </SelectionMenuAction>
      <SelectionMenuAction
        label={labels.preview}
        pressed={snapshot.mode === 'preview'}
        disabled={snapshot.disabled}
        onClick={() => commands.setMode('preview')}
        testId="tiptap-executable-preview"
      >
        <IconEye size={16} aria-hidden />
      </SelectionMenuAction>
      {snapshot.running ? (
        <SelectionMenuAction
          label={labels.stop}
          disabled={snapshot.disabled}
          onClick={commands.stop}
          testId="tiptap-executable-stop"
        >
          <IconPlayerStop size={16} aria-hidden />
        </SelectionMenuAction>
      ) : (
        <SelectionMenuAction
          label={labels.run}
          disabled={snapshot.disabled}
          onClick={commands.run}
          testId="tiptap-executable-run"
        >
          <IconPlayerPlay size={16} aria-hidden />
        </SelectionMenuAction>
      )}
      <SelectionMenuAction
        label={labels.restart}
        disabled={snapshot.disabled}
        onClick={commands.restart}
        testId="tiptap-executable-restart"
      >
        <IconRefresh size={16} aria-hidden />
      </SelectionMenuAction>
      <AlignmentMenuActions
        value={snapshot.textAlignment}
        labels={labels}
        disabled={snapshot.disabled}
        onChange={commands.setAlignment}
        testIdPrefix="tiptap-executable-align"
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
