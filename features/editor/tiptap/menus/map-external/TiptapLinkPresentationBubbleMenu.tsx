'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  chooseLinkPresentation,
  dismissPastedLink,
  getLinkPresentationState,
  type LinkPresentationRuntime,
} from '../../link-presentation/LinkCardTiptapExtension';
import {
  availableLinkPresentations,
  findStandaloneLink,
  type LinkPresentation,
  type StandaloneLinkBlock,
} from '../../link-presentation/link-presentation';
import { useTiptapBubbleMenu } from '../useSelectionToolbarNavigation';
import { LinkPresentationActions, type LinkPresentationLabels } from './LinkPresentationActions';
import { SelectionMenuSurface } from './SelectionMenuPrimitives';

const BUBBLE_OPTIONS = { placement: 'bottom-start', offset: 8, flip: true, shift: true } as const;

interface LinkPresentationTarget {
  blockId: string;
  url: string;
  current: LinkPresentation;
  entry: StandaloneLinkBlock | null;
}

/** The pasted link while its menu is open, or the selected card. Videos use their own menu. */
export function resolveLinkPresentationTarget(editor: Editor): LinkPresentationTarget | null {
  const { selection } = editor.state;
  const pasted = getLinkPresentationState(editor.state).pasted;
  if (pasted && !(selection instanceof NodeSelection)) {
    const entry = findStandaloneLink(editor.state, pasted.blockId);
    return { ...pasted, current: entry?.url === pasted.url ? entry.presentation : 'link', entry };
  }
  if (selection instanceof NodeSelection && selection.node.type.name === 'linkCard') {
    const blockId = String(selection.$from.parent.attrs.id ?? '');
    const entry = findStandaloneLink(editor.state, blockId);
    return entry ? { blockId, url: entry.url, current: entry.presentation, entry } : null;
  }
  return null;
}

export interface TiptapLinkPresentationBubbleMenuProps {
  editor: Editor;
  labels: LinkPresentationLabels;
  runtime?: LinkPresentationRuntime;
}

export function TiptapLinkPresentationBubbleMenu({ editor, labels, runtime }: TiptapLinkPresentationBubbleMenuProps) {
  const [, setRevision] = useState(0);
  const menu = useTiptapBubbleMenu(editor, 'tiptap-link-presentation-menu');
  useEffect(() => {
    const refresh = () => setRevision((revision) => revision + 1);
    editor.on('transaction', refresh);
    return () => {
      editor.off('transaction', refresh);
    };
  }, [editor]);
  const shouldShow = useCallback(
    ({ editor: current }: { editor: Editor }) =>
      !menu.isSuppressed && current.isEditable && Boolean(resolveLinkPresentationTarget(current)),
    [menu.isSuppressed],
  );

  const target = resolveLinkPresentationTarget(editor);
  if (menu.isSuppressed || !editor.isEditable || !target) {
    return null;
  }
  const pending = getLinkPresentationState(editor.state).pending.includes(target.blockId);
  const choose = (presentation: LinkPresentation, refresh = false) => {
    void chooseLinkPresentation(editor, runtime, target, presentation, { refresh });
  };

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={menu.pluginKey}
      updateDelay={0}
      shouldShow={shouldShow}
      options={BUBBLE_OPTIONS}
    >
      <SelectionMenuSurface
        label={labels.menu}
        testId="tiptap-link-presentation-menu"
        editorElement={editor.view.dom}
        navigationEnabled
        onEscape={() => {
          dismissPastedLink(editor);
          menu.hide();
        }}
      >
        <LinkPresentationActions
          labels={labels}
          presentations={availableLinkPresentations(target.url, editor.schema)}
          current={target.current}
          onChange={(presentation) => choose(presentation)}
          onRefresh={target.entry && target.current !== 'link' ? () => choose(target.current, true) : undefined}
          refreshing={pending}
        />
      </SelectionMenuSurface>
    </BubbleMenu>
  );
}
