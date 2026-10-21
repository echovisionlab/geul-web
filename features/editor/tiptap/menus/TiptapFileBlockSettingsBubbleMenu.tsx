'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { Editor } from '@tiptap/core';
import { NodeSelection, PluginKey } from '@tiptap/pm/state';
import { BubbleMenu } from '@tiptap/react/menus';
import classes from './TiptapFileBlockSettingsBubbleMenu.module.css';

const FILE_BLOCK_SETTINGS_OPTIONS = { placement: 'bottom-start', offset: 8, flip: true, shift: true } as const;

/**
 * The element a selected File block renders its settings into. It sits in the
 * bubble menu beside the editor, so the fields (and the hidden collection
 * templates React Aria builds for their lists) stay out of the contenteditable.
 */
export interface FileBlockSettingsSlot {
  get: () => HTMLElement | null;
  set: (element: HTMLElement | null) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createFileBlockSettingsSlot(): FileBlockSettingsSlot {
  let current: HTMLElement | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(element) {
      if (element !== current) {
        current = element;
        listeners.forEach((listener) => listener());
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const subscribeNothing = () => () => {};
const noElement = () => null;

export function useFileBlockSettingsSlot(slot: FileBlockSettingsSlot | undefined): HTMLElement | null {
  return useSyncExternalStore(slot?.subscribe ?? subscribeNothing, slot?.get ?? noElement, noElement);
}

export function isTiptapFileBlockSelected(editor: Editor): boolean {
  const { selection } = editor.state;
  return selection instanceof NodeSelection && selection.node.type.name === 'file';
}

/** Hosts the settings of the selected File block below it, outside the editable document. */
export function TiptapFileBlockSettingsBubbleMenu({ editor, slot }: { editor: Editor; slot: FileBlockSettingsSlot }) {
  const pluginKey = useMemo(() => new PluginKey('tiptap-file-block-settings'), []);
  const shouldShow = useCallback(
    ({ editor: current }: { editor: Editor }) => current.isEditable && isTiptapFileBlockSelected(current),
    [],
  );
  return (
    <BubbleMenu
      editor={editor}
      pluginKey={pluginKey}
      updateDelay={0}
      shouldShow={shouldShow}
      options={FILE_BLOCK_SETTINGS_OPTIONS}
    >
      <div ref={slot.set} className={classes.slot} data-file-block-settings="" />
    </BubbleMenu>
  );
}
