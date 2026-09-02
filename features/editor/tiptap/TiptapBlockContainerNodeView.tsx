'use client';

import { useCallback, useMemo, useState } from 'react';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { Selection } from '@tiptap/pm/state';
import { useTranslations } from 'next-intl';
import { EmojiPickerPanel } from '@/components/core/EmojiPicker';
import { IconButton } from '@/components/core/IconButton';
import { Popover } from '@/components/core/Popover';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import {
  TIPTAP_BLOCK_COLORS,
  TiptapBlockMenu,
  type TiptapBlockColor,
  type TiptapBlockMenuLabels,
} from './TiptapBlockMenu';
import { WireBlockContainer } from './wire-schema';
import { tiptapEmojiPickerItems } from './emoji';
import { useExactTiptapNodeSelection } from './useExactTiptapNodeSelection';
import { useTiptapEditorEditable } from './useTiptapEditorEditable';
import classes from './TiptapBlockContainerNodeView.module.css';

function normalizeBlockColor(value: unknown): TiptapBlockColor {
  return TIPTAP_BLOCK_COLORS.includes(value as TiptapBlockColor) ? (value as TiptapBlockColor) : 'default';
}

function canDeleteBlockAtPosition({ editor, getPos }: Pick<NodeViewProps, 'editor' | 'getPos'>): boolean {
  const position = getPos();
  if (typeof position !== 'number') {
    return false;
  }
  const $position = editor.state.doc.resolve(position);
  if ($position.parent.type.name !== 'blockGroup') {
    return false;
  }
  return $position.parent.childCount > 1 || $position.depth > 1;
}

function deleteBlockAtPosition({
  editor,
  getPos,
  authoringMode,
}: Pick<NodeViewProps, 'editor' | 'getPos'> & { authoringMode: EditorAuthoringMode }): void {
  if (!authoringMode.allowNeutralBlockEdits) {
    return;
  }
  const position = getPos();
  if (typeof position !== 'number') {
    return;
  }
  const block = editor.state.doc.nodeAt(position);
  const $position = editor.state.doc.resolve(position);
  if (!block || $position.parent.type.name !== 'blockGroup') {
    return;
  }
  if (!canDeleteBlockAtPosition({ editor, getPos })) {
    return;
  }

  const transaction = editor.state.tr;
  const nestedSoleBlock = $position.depth > 1 && $position.parent.childCount === 1;
  if (nestedSoleBlock) {
    transaction.delete($position.before(), $position.after());
  } else {
    transaction.delete(position, position + block.nodeSize);
  }
  transaction.setSelection(
    Selection.near(transaction.doc.resolve(Math.min(position + 2, transaction.doc.content.size))),
  );
  editor.view.dispatch(transaction.scrollIntoView());
  if (typeof block.attrs.id === 'string' && block.attrs.id !== '') {
    authoringMode.deleteNeutralBlock?.(block.attrs.id);
  }
  editor.commands.focus();
}

function setBlockColorAtPosition({
  editor,
  getPos,
  authoringMode,
  key,
  color,
}: Pick<NodeViewProps, 'editor' | 'getPos'> & {
  authoringMode: EditorAuthoringMode;
  key: 'textColor' | 'backgroundColor';
  color: TiptapBlockColor;
}): void {
  if (!authoringMode.allowNeutralBlockEdits) {
    return;
  }
  const position = getPos();
  if (typeof position !== 'number') {
    return;
  }
  const content = editor.state.doc.nodeAt(position)?.firstChild;
  if (!content?.type.spec.attrs?.[key]) {
    return;
  }
  const transaction = editor.state.tr.setNodeMarkup(position + 1, undefined, {
    ...content.attrs,
    [key]: color,
  });
  editor.view.dispatch(transaction.scrollIntoView());
  const block = editor.state.doc.nodeAt(position);
  if (typeof block?.attrs.id === 'string' && block.attrs.id !== '') {
    authoringMode.applyNeutralBlockProps?.(block.attrs.id, { [key]: color });
  }
  editor.commands.focus();
}

function setCalloutIconAtPosition({
  editor,
  getPos,
  authoringMode,
  icon,
}: Pick<NodeViewProps, 'editor' | 'getPos'> & {
  authoringMode: EditorAuthoringMode;
  icon: string;
}): void {
  if (!authoringMode.allowNeutralBlockEdits) {
    return;
  }
  const position = getPos();
  if (typeof position !== 'number') {
    return;
  }
  const content = editor.state.doc.nodeAt(position)?.firstChild;
  if (content?.type.name !== 'callout') {
    return;
  }
  const transaction = editor.state.tr.setNodeMarkup(position + 1, undefined, {
    ...content.attrs,
    icon,
  });
  editor.view.dispatch(transaction.scrollIntoView());
  const block = editor.state.doc.nodeAt(position);
  if (typeof block?.attrs.id === 'string' && block.attrs.id !== '') {
    authoringMode.applyNeutralBlockProps?.(block.attrs.id, { icon });
  }
  editor.commands.focus();
}

function TiptapBlockContainerNodeView({
  editor,
  getPos,
  node,
  authoringMode,
}: NodeViewProps & { authoringMode: EditorAuthoringMode | null }) {
  const t = useTranslations('editorCommon.editor');
  const emoji = useTranslations('editorCommon.editor.slashMenu.items.emoji');
  const searchCombobox = useTranslations('searchCombobox');
  const [iconPickerOpened, setIconPickerOpened] = useState(false);
  const [iconQuery, setIconQuery] = useState('');
  const labels: TiptapBlockMenuLabels = useMemo(
    () => ({
      open: t('drag.openBlockMenu'),
      delete: t('drag.delete'),
      colors: t('drag.colors'),
      textColor: t('colors.text'),
      backgroundColor: t('colors.background'),
      colorNames: {
        default: t('colors.names.default'),
        gray: t('colors.names.gray'),
        brown: t('colors.names.brown'),
        red: t('colors.names.red'),
        orange: t('colors.names.orange'),
        yellow: t('colors.names.yellow'),
        green: t('colors.names.green'),
        blue: t('colors.names.blue'),
        purple: t('colors.names.purple'),
        pink: t('colors.names.pink'),
      },
    }),
    [t],
  );
  const content = node.firstChild;
  const editorEditable = useTiptapEditorEditable(editor);
  const exactNodeSelected = useExactTiptapNodeSelection({ editor, getPos });
  const canEditNeutral = editorEditable && authoringMode?.allowNeutralBlockEdits === true;
  const authoringSelected = editorEditable && exactNodeSelected;
  const canDelete = canEditNeutral && canDeleteBlockAtPosition({ editor, getPos });
  const canSetTextColor = Boolean(content?.type.spec.attrs?.textColor);
  const canSetBackgroundColor = Boolean(content?.type.spec.attrs?.backgroundColor);
  const calloutIcon = content?.type.name === 'callout' ? String(content.attrs.icon ?? '💡') : undefined;
  const showCalloutIconPicker = canEditNeutral && calloutIcon !== undefined;
  const iconPickerItems = useMemo(
    () => (iconPickerOpened ? tiptapEmojiPickerItems(iconQuery) : []),
    [iconPickerOpened, iconQuery],
  );
  const deleteBlock = useCallback(() => {
    if (editor.isEditable && authoringMode) {
      deleteBlockAtPosition({ editor, getPos, authoringMode });
    }
  }, [authoringMode, editor, getPos]);
  const setTextColor = useCallback(
    (color: TiptapBlockColor) => {
      if (editor.isEditable && authoringMode) {
        setBlockColorAtPosition({ editor, getPos, authoringMode, key: 'textColor', color });
      }
    },
    [authoringMode, editor, getPos],
  );
  const setBackgroundColor = useCallback(
    (color: TiptapBlockColor) => {
      if (editor.isEditable && authoringMode) {
        setBlockColorAtPosition({ editor, getPos, authoringMode, key: 'backgroundColor', color });
      }
    },
    [authoringMode, editor, getPos],
  );
  const setCalloutIcon = useCallback(
    (icon: string) => {
      if (editor.isEditable && authoringMode) {
        setCalloutIconAtPosition({ editor, getPos, authoringMode, icon });
      }
    },
    [authoringMode, editor, getPos],
  );

  return (
    <NodeViewWrapper
      className={[classes.container, 'editor-block-container'].join(' ')}
      data-node-type="blockContainer"
      data-id={String(node.attrs.id ?? '')}
      data-container-kind={content?.type.name}
      data-callout-icon-picker={showCalloutIconPicker || undefined}
      data-selected={authoringSelected || undefined}
      draggable={false}
    >
      {canEditNeutral ? (
        <div className={classes.handle} contentEditable={false}>
          <TiptapBlockMenu
            labels={labels}
            canSetTextColor={canSetTextColor}
            canSetBackgroundColor={canSetBackgroundColor}
            textColor={normalizeBlockColor(content?.attrs.textColor)}
            backgroundColor={normalizeBlockColor(content?.attrs.backgroundColor)}
            canDelete={canDelete}
            onDelete={deleteBlock}
            onTextColorChange={setTextColor}
            onBackgroundColorChange={setBackgroundColor}
          />
        </div>
      ) : null}
      {showCalloutIconPicker ? (
        <div className={classes.calloutIconPicker} contentEditable={false}>
          <Popover
            open={iconPickerOpened}
            onOpenChange={(opened) => {
              setIconPickerOpened(opened);
              if (!opened) {
                setIconQuery('');
              }
            }}
            placement="bottom-start"
            size="compact"
            portal
          >
            <Popover.Target>
              <IconButton
                label={emoji('title')}
                title={emoji('title')}
                tone="neutral"
                emphasis="low"
                size="sm"
                data-testid="tiptap-callout-icon-picker"
                onClick={() => setIconPickerOpened((opened) => !opened)}
              >
                <span aria-hidden>{calloutIcon}</span>
              </IconButton>
            </Popover.Target>
            <Popover.Dropdown padding="compact" role="dialog" data-testid="tiptap-callout-icon-popover">
              <EmojiPickerPanel
                title={emoji('title')}
                searchPlaceholder={emoji('subtext')}
                noResults={searchCombobox('noResults')}
                query={iconQuery}
                items={iconPickerItems}
                onQueryChange={setIconQuery}
                onSelect={(item) => {
                  setIconPickerOpened(false);
                  setIconQuery('');
                  setCalloutIcon(item.value);
                }}
              />
            </Popover.Dropdown>
          </Popover>
        </div>
      ) : null}
      <NodeViewContent
        className={classes.content}
        data-bg-color={
          content?.type.name === 'callout' ? normalizeBlockColor(content.attrs.backgroundColor) : undefined
        }
        data-text-color={content?.type.name === 'callout' ? normalizeBlockColor(content.attrs.textColor) : undefined}
      />
    </NodeViewWrapper>
  );
}

interface TiptapBlockContainerOptions {
  authoringMode: EditorAuthoringMode | null;
}

/**
 * Internal composition boundary. Mutating block UI is fail-closed unless the
 * host passes its exact neutral/localized authoring authority.
 */
export function createTiptapBlockContainer(authoringMode: EditorAuthoringMode | null = null) {
  return WireBlockContainer.extend<TiptapBlockContainerOptions>({
    draggable: true,
    addOptions() {
      return { authoringMode };
    },
    addNodeView() {
      const options = this.options;
      return ReactNodeViewRenderer((props) => (
        <TiptapBlockContainerNodeView {...props} authoringMode={options.authoringMode} />
      ));
    },
  });
}

export const TiptapBlockContainer = createTiptapBlockContainer();
