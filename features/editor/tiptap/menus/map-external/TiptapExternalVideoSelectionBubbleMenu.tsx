'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { BubbleMenu } from '@tiptap/react/menus';
import { useTiptapBubbleMenu } from '../useSelectionToolbarNavigation';
import {
  getTiptapStandaloneExternalVideos,
  updateTiptapExternalVideoLayout,
  type TiptapStandaloneExternalVideo,
} from '../../external-video/ExternalVideoTiptapExtension';
import { ExternalVideoSelectionMenu, type ExternalVideoSelectionMenuLabels } from './ExternalVideoSelectionMenu';

const EXTERNAL_VIDEO_BUBBLE_OPTIONS = { placement: 'top', offset: 8, flip: true, shift: true } as const;

export function resolveSelectedTiptapExternalVideo(editor: Editor): TiptapStandaloneExternalVideo | null {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) {
    return null;
  }
  return (
    getTiptapStandaloneExternalVideos(editor.view).find(
      (entry) => entry.blockPosition === selection.from || entry.nodePosition === selection.from,
    ) ?? null
  );
}

export interface TiptapExternalVideoSelectionBubbleMenuProps {
  editor: Editor;
  labels: ExternalVideoSelectionMenuLabels;
  onEditLink?: (video: TiptapStandaloneExternalVideo) => void;
}

/** Mount-ready adapter for the existing durable standalone paragraph-link contract. */
export function TiptapExternalVideoSelectionBubbleMenu({
  editor,
  labels,
  onEditLink,
}: TiptapExternalVideoSelectionBubbleMenuProps) {
  const [, setRevision] = useState(0);
  const menu = useTiptapBubbleMenu(editor, 'tiptap-external-video-selection-menu');
  useEffect(() => {
    const refresh = () => setRevision((revision) => revision + 1);
    editor.on('transaction', refresh);
    return () => {
      editor.off('transaction', refresh);
    };
  }, [editor]);

  const shouldShow = useCallback(
    ({ editor: current }: { editor: Editor }) =>
      !menu.isDismissed && current.isEditable && Boolean(resolveSelectedTiptapExternalVideo(current)),
    [menu.isDismissed],
  );

  const selected = resolveSelectedTiptapExternalVideo(editor);
  if (menu.isDismissed || !editor.isEditable || !selected) {
    return null;
  }

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={menu.pluginKey}
      updateDelay={0}
      shouldShow={shouldShow}
      options={EXTERNAL_VIDEO_BUBBLE_OPTIONS}
    >
      <ExternalVideoSelectionMenu
        labels={labels}
        aspectRatio={selected.aspectRatio}
        textAlignment={selected.textAlignment}
        previewWidth={selected.previewWidth}
        editorElement={editor.view.dom}
        navigationEnabled
        onEditLink={() => {
          onEditLink?.(selected);
        }}
        onChangeAspectRatio={(aspectRatio) => {
          updateTiptapExternalVideoLayout(editor, { aspectRatio }, selected.blockId);
        }}
        onChangeAlignment={(textAlignment) => {
          updateTiptapExternalVideoLayout(editor, { textAlignment }, selected.blockId);
        }}
        onEscape={menu.hide}
      />
    </BubbleMenu>
  );
}
