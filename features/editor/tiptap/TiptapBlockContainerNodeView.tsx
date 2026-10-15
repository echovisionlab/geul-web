'use client';

import { liveNodeView } from '@/features/editor/tiptap/live-node-view';
import { useCallback, useMemo, useState } from 'react';
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type NodeViewProps,
} from '@tiptap/react';
import { NodeSelection, Selection, TextSelection } from '@tiptap/pm/state';
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
import { loadTiptapEmojiData, tiptapEmojiPickerItems, useTiptapEmojiData } from './emoji';
import { useExactTiptapNodeSelection } from './useExactTiptapNodeSelection';
import { useTiptapEditorEditable } from './useTiptapEditorEditable';
import classes from './TiptapBlockContainerNodeView.module.css';
import { ReorderGutter } from '@/components/core/Sortable';

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
  const textSelected = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current.state.selection instanceof TextSelection && !current.state.selection.empty,
  });
  const [iconPickerRequested, setIconPickerRequested] = useState(false);
  const emojiData = useTiptapEmojiData();
  // The Emoji data loads when the picker is requested; the popover opens once its items exist.
  const iconPickerOpened = iconPickerRequested && emojiData !== null;
  const [iconQuery, setIconQuery] = useState('');
  const [dragging, setDragging] = useState(false);
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
    () => (iconPickerOpened && emojiData ? tiptapEmojiPickerItems(emojiData, iconQuery) : []),
    [emojiData, iconPickerOpened, iconQuery],
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
      <ReorderGutter
        visibility={dragging ? 'active' : 'on-interaction'}
        handle={
          canEditNeutral && !textSelected ? (
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
              onDraggingChange={setDragging}
            />
          ) : undefined
        }
      >
        {showCalloutIconPicker ? (
          <div className={classes.calloutIconPicker} contentEditable={false}>
            <Popover
              open={iconPickerOpened}
              onOpenChange={(opened) => {
                setIconPickerRequested(opened);
                if (!opened) {
                  setIconQuery('');
                } else if (!emojiData) {
                  loadTiptapEmojiData().catch(() => setIconPickerRequested(false));
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
                >
                  <span className={classes.calloutPickerGlyph} aria-hidden>
                    {calloutIcon}
                  </span>
                </IconButton>
              </Popover.Target>
              <Popover.Dropdown padding="compact" role="dialog" data-testid="tiptap-callout-icon-popover">
                <EmojiPickerPanel
                  density="compact"
                  title={emoji('title')}
                  searchPlaceholder={emoji('subtext')}
                  noResults={searchCombobox('noResults')}
                  query={iconQuery}
                  items={iconPickerItems}
                  onQueryChange={setIconQuery}
                  onSelect={(item) => {
                    setIconPickerRequested(false);
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
          data-content-kind={content?.type.name}
          data-bg-color={
            content?.type.name === 'callout' ? normalizeBlockColor(content.attrs.backgroundColor) : undefined
          }
          data-text-color={content?.type.name === 'callout' ? normalizeBlockColor(content.attrs.textColor) : undefined}
        />
      </ReorderGutter>
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
      const render = ReactNodeViewRenderer(
        liveNodeView(this.name, options, (props, current) => (
          <TiptapBlockContainerNodeView {...props} authoringMode={current.authoringMode} />
        )),
      );
      return (props) => {
        const view = render(props);
        if (!view.dom) {
          return view;
        }
        const stopEvent = view.stopEvent?.bind(view);
        view.stopEvent = (event) => {
          const target = event.target instanceof Element ? event.target : null;
          const handle = target?.closest('[data-drag-handle]');
          // Tiptap treats BUTTON mousedown as an input event before enabling its
          // drag path. Forward this handle's drag events to ProseMirror, which serializes
          // the whole block and performs the native move on drop.
          if (
            props.editor.isEditable &&
            options.authoringMode?.allowNeutralBlockEdits &&
            handle &&
            view.dom.contains(handle) &&
            !view.contentDOM?.contains(handle) &&
            event.type.startsWith('drag')
          ) {
            // The editor's native listener can run before the React portal's
            // onDragStart. Select this block before ProseMirror reads the payload.
            if (event.type === 'dragstart') {
              const position = props.getPos();
              if (typeof position === 'number') {
                props.editor.view.dispatch(
                  props.editor.state.tr.setSelection(NodeSelection.create(props.editor.state.doc, position)),
                );
              }
            }
            return false;
          }
          return stopEvent?.(event) ?? false;
        };
        return view;
      };
    },
  });
}

export const TiptapBlockContainer = createTiptapBlockContainer();
