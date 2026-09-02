'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import { BubbleMenu, type BubbleMenuProps } from '@tiptap/react/menus';
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconCheck,
  IconMathFunction,
  IconMusic,
  IconPaperclip,
  IconPhoto,
  IconTrash,
  IconVideo,
  IconX,
  type Icon,
} from '@tabler/icons-react';
import { useLocale, useTranslations, type Messages } from 'next-intl';
import { IconButton } from '@/components/core/IconButton';
import { TextInput } from '@/components/core/Input';
import {
  EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS,
  EditorToolbarTooltip,
  type EditorToolbarShortcutHint,
} from '@/features/editor/toolbars/EditorToolbarTooltip';
import { setCurrentBlockAlignment, type TextAlignment } from './block-commands';
import {
  createTiptapSlashCatalog,
  applyTiptapSlashEmoji,
  executeTiptapSlashItem,
  filterTiptapSlashCatalog,
  reduceTiptapSlashNavigation,
  selectableTiptapSlashItems,
  type TiptapSlashActionContext as ReviewedSlashActionContext,
  type TiptapSlashCapabilities as ReviewedSlashCapabilities,
  type TiptapSlashCapability as ReviewedSlashCapability,
  type TiptapSlashItem as ReviewedSlashItem,
  type TiptapSlashMenuMessages,
  type TiptapSlashRange as ReviewedSlashRange,
  type TiptapSlashWorkflowCallbacks,
} from './slash';
import { TiptapEmojiPicker } from './emoji';
import {
  createDelegatedWorkflow,
  createFileWorkflow,
  createImmediateNodeWorkflow,
} from './integration/slash-workflows';
import {
  useTiptapBubbleMenu,
  useSelectionToolbarEditorTabBridge,
  useSelectionToolbarNavigation,
} from './menus/useSelectionToolbarNavigation';
import classes from './TiptapAuthoringControls.module.css';

export type TiptapAuthoringCapability = ReviewedSlashCapability;
export type TiptapAuthoringCapabilities = ReviewedSlashCapabilities;
export type TiptapSlashActionContext = ReviewedSlashActionContext;
export type TiptapSlashItem = ReviewedSlashItem;
export type SlashRange = ReviewedSlashRange;

/** Existing host callbacks remain the public workflow boundary. */
export interface TiptapAuthoringControlsCallbacks {
  onMathActivate?: (context: TiptapSlashActionContext) => void;
  onTableActivate?: (context: TiptapSlashActionContext) => void;
  onMapActivate?: (context: TiptapSlashActionContext) => void;
  onFileActivate?: (blockId: string, context?: TiptapSlashActionContext) => void;
  onAIAssistantActivate?: (context: TiptapSlashActionContext) => void;
  onExternalVideoActivate?: (context: TiptapSlashActionContext) => void;
}

interface SlashMenuState extends SlashRange {
  query: string;
  left: number;
  top: number;
}

type SlashMenuStyle = CSSProperties & {
  '--tiptap-slash-menu-left': string;
};

function callbackWorkflows(callbacks: TiptapAuthoringControlsCallbacks): TiptapSlashWorkflowCallbacks {
  return {
    map: createDelegatedWorkflow(callbacks.onMapActivate),
    file: createFileWorkflow(callbacks.onFileActivate),
    externalVideo: createDelegatedWorkflow(callbacks.onExternalVideoActivate),
    ai: createDelegatedWorkflow(callbacks.onAIAssistantActivate),
  };
}

function splitSlashAliases(aliases: string): readonly string[] {
  return aliases.split('\n');
}

function buildSlashMenuMessages(messages: Messages['editorCommon']['editor']['slashMenu']): TiptapSlashMenuMessages {
  return {
    placeholder: messages.placeholder,
    unavailable: messages.unavailable,
    groups: messages.groups,
    items: {
      heading: { ...messages.items.heading, aliases: splitSlashAliases(messages.items.heading.aliases) },
      heading2: { ...messages.items.heading2, aliases: splitSlashAliases(messages.items.heading2.aliases) },
      heading3: { ...messages.items.heading3, aliases: splitSlashAliases(messages.items.heading3.aliases) },
      paragraph: { ...messages.items.paragraph, aliases: splitSlashAliases(messages.items.paragraph.aliases) },
      bulletList: { ...messages.items.bulletList, aliases: splitSlashAliases(messages.items.bulletList.aliases) },
      numberedList: { ...messages.items.numberedList, aliases: splitSlashAliases(messages.items.numberedList.aliases) },
      checkList: { ...messages.items.checkList, aliases: splitSlashAliases(messages.items.checkList.aliases) },
      quote: { ...messages.items.quote, aliases: splitSlashAliases(messages.items.quote.aliases) },
      callout: { ...messages.items.callout, aliases: splitSlashAliases(messages.items.callout.aliases) },
      divider: { ...messages.items.divider, aliases: splitSlashAliases(messages.items.divider.aliases) },
      codeBlock: { ...messages.items.codeBlock, aliases: splitSlashAliases(messages.items.codeBlock.aliases) },
      table: { ...messages.items.table, aliases: splitSlashAliases(messages.items.table.aliases) },
      emoji: { ...messages.items.emoji, aliases: splitSlashAliases(messages.items.emoji.aliases) },
      mathBlock: { ...messages.items.mathBlock, aliases: splitSlashAliases(messages.items.mathBlock.aliases) },
      inlineMath: { ...messages.items.inlineMath, aliases: splitSlashAliases(messages.items.inlineMath.aliases) },
      map: { ...messages.items.map, aliases: splitSlashAliases(messages.items.map.aliases) },
      externalVideo: {
        ...messages.items.externalVideo,
        aliases: splitSlashAliases(messages.items.externalVideo.aliases),
      },
      p5Sketch: { ...messages.items.p5Sketch, aliases: splitSlashAliases(messages.items.p5Sketch.aliases) },
      threeScene: { ...messages.items.threeScene, aliases: splitSlashAliases(messages.items.threeScene.aliases) },
      shader: { ...messages.items.shader, aliases: splitSlashAliases(messages.items.shader.aliases) },
      file: { ...messages.items.file, aliases: splitSlashAliases(messages.items.file.aliases) },
      aiAssistant: { ...messages.items.aiAssistant, aliases: splitSlashAliases(messages.items.aiAssistant.aliases) },
    },
  };
}

/** Compatibility export backed by the single reviewed catalog. */
export function createTiptapSlashItems(
  editorMessages: Messages['editorCommon']['editor'],
  capabilities: TiptapAuthoringCapabilities = {},
  callbacks: TiptapAuthoringControlsCallbacks = {},
): TiptapSlashItem[] {
  const workflows = callbackWorkflows(callbacks);
  return createTiptapSlashCatalog(buildSlashMenuMessages(editorMessages.slashMenu), {
    capabilities: {
      math: capabilities.math !== false,
      table: capabilities.table === true,
      ...capabilities,
    },
    callbacks: workflows,
  });
}

/** Compatibility export backed by the single reviewed executor. */
export function applyTiptapSlashItem(editor: Editor, item: TiptapSlashItem, range: SlashRange): boolean {
  return executeTiptapSlashItem({ editor, item, range }).status === 'applied';
}

function slashQueryAfterInlineNode(parent: ProseMirrorNode, parentOffset: number): string | null {
  let previousNode: ProseMirrorNode | null = null;
  let query: string | null = null;
  parent.forEach((child, childOffset) => {
    const cursorOffset = parentOffset - childOffset;
    if (
      query === null &&
      previousNode?.isInline &&
      !previousNode.isText &&
      child.isText &&
      cursorOffset >= 0 &&
      cursorOffset <= child.nodeSize
    ) {
      query = /^\/([^\s/]*)$/u.exec(child.text?.slice(0, cursorOffset) ?? '')?.[1] ?? null;
    }
    previousNode = child;
  });
  return query;
}

export function getSlashMenuState(editor: Editor): SlashMenuState | null {
  if (!editor.isEditable || !editor.state.selection.empty) {
    return null;
  }
  const { $from, from } = editor.state.selection;
  if (!$from.parent.isTextblock) {
    return null;
  }
  const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n');
  const query =
    /(?:^|\s)\/([^\s/]*)$/u.exec(textBeforeCursor)?.[1] ?? slashQueryAfterInlineNode($from.parent, $from.parentOffset);
  if (query === null) {
    return null;
  }
  // Inline nodes and their source text do not map one-to-one onto document
  // positions, so measure the trigger backwards from the actual cursor.
  const slashFrom = from - (query.length + 1);
  const contentPosition = $from.before($from.depth);
  const blockId = String($from.node($from.depth - 1).attrs.id ?? '');
  const coordinates = editor.view.coordsAtPos(slashFrom);
  const root = editor.view.dom.closest('.tiptap-editor')?.getBoundingClientRect();
  return {
    query: query.toLocaleLowerCase(),
    from: slashFrom,
    to: from,
    contentPosition,
    blockId,
    left: Math.max(8, coordinates.left - (root?.left ?? 0)),
    top: Math.max(8, coordinates.bottom - (root?.top ?? 0)),
  };
}

const bubbleOptions: NonNullable<BubbleMenuProps['options']> = {
  placement: 'top',
  offset: 8,
  flip: true,
  shift: true,
};

type SelectedNodeName = 'file' | 'math';

function isSelectedNode(selection: unknown, nodeName: SelectedNodeName): selection is NodeSelection {
  return selection instanceof NodeSelection && selection.node.type.name === nodeName;
}

function canShowNodeMenu(editor: Editor, nodeName: SelectedNodeName): boolean {
  return editor.isEditable && isSelectedNode(editor.state.selection, nodeName);
}

function shouldShowNodeMenu(nodeName: SelectedNodeName): NonNullable<BubbleMenuProps['shouldShow']> {
  return ({ editor, element, view }) =>
    canShowNodeMenu(editor, nodeName) && (view.hasFocus() || element.contains(document.activeElement));
}

function canBridgeNodeMenu(editor: Editor, nodeName: SelectedNodeName): boolean {
  return canShowNodeMenu(editor, nodeName) && editor.view.hasFocus();
}

const shouldShowFileBubbleMenu = shouldShowNodeMenu('file');
const shouldShowMathBubbleMenu = shouldShowNodeMenu('math');

function preserveSelection(event: MouseEvent | PointerEvent) {
  event.preventDefault();
}

function Action({
  label,
  children,
  onClick,
  active = false,
  testId,
  shortcut,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  testId?: string;
  shortcut?: EditorToolbarShortcutHint;
}) {
  return (
    <EditorToolbarTooltip label={label} shortcut={shortcut}>
      <IconButton
        label={label}
        tone={active ? 'accent' : 'neutral'}
        emphasis={active ? 'medium' : 'low'}
        size="sm"
        data-selection-toolbar-action=""
        data-testid={testId}
        onMouseDown={preserveSelection}
        onPointerDown={preserveSelection}
        onClick={onClick}
      >
        {children}
      </IconButton>
    </EditorToolbarTooltip>
  );
}

function AlignmentActions({ editor }: { editor: Editor }) {
  const t = useTranslations('editorCommon.editor.formatting');
  const selection = editor.state.selection;
  const current = selection instanceof NodeSelection ? String(selection.node.attrs.textAlignment ?? 'left') : 'left';
  const actions: readonly [TextAlignment, Icon, string][] = [
    ['left', IconAlignLeft, t('alignLeft')],
    ['center', IconAlignCenter, t('alignCenter')],
    ['right', IconAlignRight, t('alignRight')],
  ];
  return (
    <div className="tiptap-editor__bubble-menu-group" role="group" aria-label={t('alignment')}>
      {actions.map(([value, IconComponent, label]) => (
        <Action
          key={value}
          label={label}
          shortcut={EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS}
          active={current === value}
          testId={`tiptap-toolbar-align-${value}`}
          onClick={() => setCurrentBlockAlignment(editor, value)}
        >
          <IconComponent size={16} />
        </Action>
      ))}
    </div>
  );
}

function fileIcon(mimeType: string): Icon {
  if (mimeType.startsWith('image/')) {
    return IconPhoto;
  }
  if (mimeType.startsWith('audio/')) {
    return IconMusic;
  }
  if (mimeType.startsWith('video/')) {
    return IconVideo;
  }
  return IconPaperclip;
}

function FileBubbleMenu({ editor, onFileActivate }: { editor: Editor; onFileActivate?: (blockId: string) => void }) {
  const t = useTranslations('editorCommon.editor.file');
  const actions = useTranslations('common.actions');
  const formatting = useTranslations('editorCommon.editor.formatting');
  const selection = editor.state.selection;
  const menu = useTiptapBubbleMenu(editor, 'tiptap-file-menu');
  const dismissMenu = menu.hide;
  const navigation = useSelectionToolbarNavigation({ onEscape: dismissMenu });
  useSelectionToolbarEditorTabBridge(
    editor.view.dom,
    navigation.focusFirstAction,
    canBridgeNodeMenu(editor, 'file'),
    dismissMenu,
  );
  if (!editor.isEditable || !isSelectedNode(selection, 'file')) {
    return null;
  }
  const IconComponent = fileIcon(
    String(selection.node.attrs.mimeType ?? '')
      .trim()
      .toLowerCase(),
  );
  return (
    <BubbleMenu
      editor={editor}
      pluginKey={menu.pluginKey}
      updateDelay={0}
      shouldShow={shouldShowFileBubbleMenu}
      options={bubbleOptions}
    >
      <div
        ref={navigation.toolbarRef}
        className="tiptap-editor__context-menu"
        data-testid="tiptap-file-menu"
        role="toolbar"
        aria-label={`${t('replace', { item: '' }).trim()}, ${formatting('alignment')}, ${actions('remove')}`}
        onKeyDownCapture={navigation.onToolbarKeyDown}
        onFocusCapture={navigation.onToolbarFocusCapture}
      >
        <Action
          label={t('replace', { item: '' }).trim()}
          testId="tiptap-file-replace"
          onClick={() => {
            const current = editor.state.selection;
            if (isSelectedNode(current, 'file')) {
              const blockId = String(current.$from.parent.attrs.id ?? '');
              if (blockId) {
                onFileActivate?.(blockId);
              }
            }
          }}
        >
          <IconComponent size={16} />
        </Action>
        <AlignmentActions editor={editor} />
        <Action
          label={actions('remove')}
          testId="tiptap-file-delete"
          onClick={() => editor.chain().focus().deleteSelection().run()}
        >
          <IconTrash size={16} />
        </Action>
      </div>
    </BubbleMenu>
  );
}

function MathBubbleMenu({ editor }: { editor: Editor }) {
  const math = useTranslations('editorCommon.editor.math');
  const actions = useTranslations('common.actions');
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const selection = editor.state.selection;
  const selected = isSelectedNode(selection, 'math');
  const menu = useTiptapBubbleMenu(editor, 'tiptap-math-menu');
  const dismissMenu = menu.hide;
  const navigation = useSelectionToolbarNavigation({ onEscape: dismissMenu });
  useSelectionToolbarEditorTabBridge(
    editor.view.dom,
    navigation.focusFirstAction,
    canBridgeNodeMenu(editor, 'math'),
    dismissMenu,
  );
  const source = selected ? String(selection.node.attrs.latex ?? '') : '';
  useEffect(() => {
    if (!selected) {
      setEditing(false);
      setDraft('');
    }
  }, [selected]);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);
  if (!editor.isEditable || !selected) {
    return null;
  }
  const save = () => {
    const current = editor.state.selection;
    if (!isSelectedNode(current, 'math')) {
      return;
    }
    const transaction = editor.state.tr.setNodeMarkup(current.from, undefined, { ...current.node.attrs, latex: draft });
    transaction.setSelection(NodeSelection.create(transaction.doc, current.from));
    editor.view.dispatch(transaction.scrollIntoView());
    setEditing(false);
    editor.view.focus();
  };
  const cancel = () => {
    setDraft(source);
    setEditing(false);
    editor.view.focus();
  };
  const editLabel = actions('edit');
  return (
    <BubbleMenu
      editor={editor}
      pluginKey={menu.pluginKey}
      updateDelay={0}
      shouldShow={shouldShowMathBubbleMenu}
      options={bubbleOptions}
    >
      <div
        ref={navigation.toolbarRef}
        className="tiptap-editor__context-menu"
        data-testid="tiptap-math-menu"
        role="toolbar"
        aria-label={math('block')}
        onKeyDownCapture={navigation.onToolbarKeyDown}
        onFocusCapture={navigation.onToolbarFocusCapture}
      >
        {editing ? (
          <>
            <TextInput
              ref={inputRef}
              aria-label={editLabel}
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  cancel();
                  menu.hide();
                } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  event.stopPropagation();
                  save();
                }
              }}
            />
            <Action label={actions('save')} testId="tiptap-math-save" onClick={save}>
              <IconCheck size={16} />
            </Action>
            <Action label={actions('cancel')} testId="tiptap-math-cancel" onClick={cancel}>
              <IconX size={16} />
            </Action>
          </>
        ) : (
          <>
            <Action
              label={editLabel}
              testId="tiptap-math-edit"
              onClick={() => {
                setDraft(source);
                setEditing(true);
              }}
            >
              <IconMathFunction size={16} />
            </Action>
            <Action
              label={actions('delete')}
              testId="tiptap-math-delete"
              onClick={() => editor.chain().focus().deleteSelection().run()}
            >
              <IconTrash size={16} />
            </Action>
          </>
        )}
      </div>
    </BubbleMenu>
  );
}

export interface TiptapAuthoringControlsProps extends TiptapAuthoringControlsCallbacks {
  editor: Editor;
  capabilities?: TiptapAuthoringCapabilities;
}

export function TiptapAuthoringControls({
  editor,
  capabilities = {},
  onMathActivate,
  onTableActivate,
  onMapActivate,
  onFileActivate,
  onAIAssistantActivate,
  onExternalVideoActivate,
}: TiptapAuthoringControlsProps) {
  const locale = useLocale();
  const slash = useTranslations('editorCommon.editor.slashMenu');
  const commonActions = useTranslations('common.actions');
  const searchCombobox = useTranslations('searchCombobox');
  const [emojiContext, setEmojiContext] = useState<TiptapSlashActionContext>();
  const messages = useMemo<TiptapSlashMenuMessages>(
    () => ({
      placeholder: slash('placeholder'),
      unavailable: slash('unavailable'),
      groups: {
        headings: slash('groups.headings'),
        basic: slash('groups.basic'),
        advanced: slash('groups.advanced'),
        others: slash('groups.others'),
        math: slash('groups.math'),
        inline: slash('groups.inline'),
        embeds: slash('groups.embeds'),
        media: slash('groups.media'),
        ai: slash('groups.ai'),
      },
      items: {
        heading: {
          title: slash('items.heading.title'),
          subtext: slash('items.heading.subtext'),
          aliases: slash('items.heading.aliases').split('\n'),
          group: slash('items.heading.group'),
        },
        heading2: {
          title: slash('items.heading2.title'),
          subtext: slash('items.heading2.subtext'),
          aliases: slash('items.heading2.aliases').split('\n'),
          group: slash('items.heading2.group'),
        },
        heading3: {
          title: slash('items.heading3.title'),
          subtext: slash('items.heading3.subtext'),
          aliases: slash('items.heading3.aliases').split('\n'),
          group: slash('items.heading3.group'),
        },
        paragraph: {
          title: slash('items.paragraph.title'),
          subtext: slash('items.paragraph.subtext'),
          aliases: slash('items.paragraph.aliases').split('\n'),
          group: slash('items.paragraph.group'),
        },
        bulletList: {
          title: slash('items.bulletList.title'),
          subtext: slash('items.bulletList.subtext'),
          aliases: slash('items.bulletList.aliases').split('\n'),
          group: slash('items.bulletList.group'),
        },
        numberedList: {
          title: slash('items.numberedList.title'),
          subtext: slash('items.numberedList.subtext'),
          aliases: slash('items.numberedList.aliases').split('\n'),
          group: slash('items.numberedList.group'),
        },
        checkList: {
          title: slash('items.checkList.title'),
          subtext: slash('items.checkList.subtext'),
          aliases: slash('items.checkList.aliases').split('\n'),
          group: slash('items.checkList.group'),
        },
        quote: {
          title: slash('items.quote.title'),
          subtext: slash('items.quote.subtext'),
          aliases: slash('items.quote.aliases').split('\n'),
          group: slash('items.quote.group'),
        },
        callout: {
          title: slash('items.callout.title'),
          subtext: slash('items.callout.subtext'),
          aliases: slash('items.callout.aliases').split('\n'),
          group: slash('items.callout.group'),
        },
        divider: {
          title: slash('items.divider.title'),
          subtext: slash('items.divider.subtext'),
          aliases: slash('items.divider.aliases').split('\n'),
          group: slash('items.divider.group'),
        },
        codeBlock: {
          title: slash('items.codeBlock.title'),
          subtext: slash('items.codeBlock.subtext'),
          aliases: slash('items.codeBlock.aliases').split('\n'),
          group: slash('items.codeBlock.group'),
        },
        table: {
          title: slash('items.table.title'),
          subtext: slash('items.table.subtext'),
          aliases: slash('items.table.aliases').split('\n'),
          group: slash('items.table.group'),
        },
        emoji: {
          title: slash('items.emoji.title'),
          subtext: slash('items.emoji.subtext'),
          aliases: slash('items.emoji.aliases').split('\n'),
          group: slash('items.emoji.group'),
        },
        mathBlock: {
          title: slash('items.mathBlock.title'),
          subtext: slash('items.mathBlock.subtext'),
          aliases: slash('items.mathBlock.aliases').split('\n'),
          group: slash('items.mathBlock.group'),
        },
        inlineMath: {
          title: slash('items.inlineMath.title'),
          subtext: slash('items.inlineMath.subtext'),
          aliases: slash('items.inlineMath.aliases').split('\n'),
          group: slash('items.inlineMath.group'),
        },
        map: {
          title: slash('items.map.title'),
          subtext: slash('items.map.subtext'),
          aliases: slash('items.map.aliases').split('\n'),
          group: slash('items.map.group'),
        },
        externalVideo: {
          title: slash('items.externalVideo.title'),
          subtext: slash('items.externalVideo.subtext'),
          aliases: slash('items.externalVideo.aliases').split('\n'),
          group: slash('items.externalVideo.group'),
        },
        p5Sketch: {
          title: slash('items.p5Sketch.title'),
          subtext: slash('items.p5Sketch.subtext'),
          aliases: slash('items.p5Sketch.aliases').split('\n'),
          group: slash('items.p5Sketch.group'),
        },
        threeScene: {
          title: slash('items.threeScene.title'),
          subtext: slash('items.threeScene.subtext'),
          aliases: slash('items.threeScene.aliases').split('\n'),
          group: slash('items.threeScene.group'),
        },
        shader: {
          title: slash('items.shader.title'),
          subtext: slash('items.shader.subtext'),
          aliases: slash('items.shader.aliases').split('\n'),
          group: slash('items.shader.group'),
        },
        file: {
          title: slash('items.file.title'),
          subtext: slash('items.file.subtext'),
          aliases: slash('items.file.aliases').split('\n'),
          group: slash('items.file.group'),
        },
        aiAssistant: {
          title: slash('items.aiAssistant.title'),
          subtext: slash('items.aiAssistant.subtext'),
          aliases: slash('items.aiAssistant.aliases').split('\n'),
          group: slash('items.aiAssistant.group'),
        },
      },
    }),
    [slash],
  );
  const callbacks = useMemo<TiptapSlashWorkflowCallbacks>(
    () => ({
      ...callbackWorkflows({
        onMathActivate,
        onTableActivate,
        onMapActivate,
        onFileActivate,
        onAIAssistantActivate,
        onExternalVideoActivate,
      }),
      p5: createImmediateNodeWorkflow(editor, 'p5Sketch'),
      three: createImmediateNodeWorkflow(editor, 'threeScene'),
      shader: createImmediateNodeWorkflow(editor, 'shader'),
      emoji: (context) => setEmojiContext(context),
    }),
    [
      editor,
      onAIAssistantActivate,
      onExternalVideoActivate,
      onFileActivate,
      onMapActivate,
      onMathActivate,
      onTableActivate,
    ],
  );
  const items = useMemo(() => {
    const catalog = createTiptapSlashCatalog(messages, {
      capabilities: {
        emoji: capabilities.emoji !== false,
        p5: capabilities.p5 !== false,
        shader: capabilities.shader !== false,
        three: capabilities.three !== false,
        ...capabilities,
      },
      callbacks,
    });
    return catalog.filter((item) => item.capability === undefined || capabilities[item.capability] !== false);
  }, [callbacks, capabilities, messages]);
  const menuId = useId();
  const activeOptionRef = useRef<HTMLButtonElement>(null);
  const [, setRevision] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissedSignature, setDismissedSignature] = useState<string>();
  const detected = getSlashMenuState(editor);
  const signature = detected ? `${detected.from}:${detected.to}:${detected.query}` : undefined;
  const slashState = signature === dismissedSignature ? null : detected;
  const slashMenuStyle = slashState
    ? ({
        '--tiptap-slash-menu-left': `${slashState.left}px`,
        top: slashState.top,
      } satisfies SlashMenuStyle)
    : undefined;
  const visibleItems = slashState ? filterTiptapSlashCatalog(items, slashState.query, locale) : [];
  const selectableItems = selectableTiptapSlashItems(visibleItems);
  const activeItem = selectableItems[activeIndex] ?? selectableItems[0];
  const activeOptionId = activeItem ? `${menuId}-${activeItem.key}` : undefined;

  useEffect(() => {
    const refresh = () => setRevision((revision) => revision + 1);
    editor.on('transaction', refresh);
    editor.on('selectionUpdate', refresh);
    return () => {
      editor.off('transaction', refresh);
      editor.off('selectionUpdate', refresh);
    };
  }, [editor]);
  useEffect(() => {
    setActiveIndex(0);
  }, [slashState?.query]);
  useEffect(() => {
    if (dismissedSignature && signature !== dismissedSignature) {
      setDismissedSignature(undefined);
    }
  }, [dismissedSignature, signature]);
  useEffect(() => {
    activeOptionRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [activeOptionId]);
  useEffect(() => {
    if (editor.isDestroyed) {
      return undefined;
    }
    const element = editor.view.dom;
    if (!slashState || !activeOptionId) {
      element.removeAttribute('aria-activedescendant');
      element.removeAttribute('aria-controls');
      return;
    }
    element.setAttribute('aria-activedescendant', activeOptionId);
    element.setAttribute('aria-controls', menuId);
    return () => {
      if (element.getAttribute('aria-controls') === menuId) {
        element.removeAttribute('aria-activedescendant');
        element.removeAttribute('aria-controls');
      }
    };
  }, [activeOptionId, editor, menuId, slashState]);

  const choose = (item: TiptapSlashItem) => {
    if (!slashState) {
      return;
    }
    const result = executeTiptapSlashItem({ editor, item, range: slashState, callbacks });
    // Delegated pickers own no document mutation until their explicit success
    // path. Dismiss this exact trigger immediately so their surface cannot
    // overlap the slash menu; a query change clears the dismissal naturally.
    if (result.status === 'delegated' && signature) {
      setDismissedSignature(signature);
    }
  };

  useEffect(() => {
    if (editor.isDestroyed) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!slashState) {
        return;
      }
      const result = reduceTiptapSlashNavigation({
        key: event.key,
        activeIndex,
        itemCount: selectableItems.length,
        isComposing: event.isComposing,
        editorIsComposing: editor.view.composing,
      });
      if (!result.preventDefault) {
        return;
      }
      event.preventDefault();
      if (result.command === 'dismiss') {
        if (signature) {
          setDismissedSignature(signature);
        }
        editor.view.focus();
      } else if (result.command === 'move') {
        setActiveIndex(result.activeIndex);
      } else if (result.command === 'activate') {
        const item = selectableItems[result.activeIndex];
        if (item) {
          choose(item);
        }
      }
    };
    const element = editor.view.dom;
    element.addEventListener('keydown', onKeyDown, true);
    return () => element.removeEventListener('keydown', onKeyDown, true);
  }, [activeIndex, callbacks, editor, selectableItems, signature, slashState]);

  return (
    <>
      <MathBubbleMenu editor={editor} />
      <FileBubbleMenu editor={editor} onFileActivate={onFileActivate} />
      {slashState && visibleItems.length > 0 ? (
        <div
          id={menuId}
          className={classes.slashMenu}
          data-testid="tiptap-slash-menu"
          role="listbox"
          aria-label={messages.placeholder}
          style={slashMenuStyle}
        >
          {visibleItems.map((item, index) => {
            const IconComponent = item.icon;
            const showGroup = index === 0 || visibleItems[index - 1]?.group !== item.group;
            return (
              <div key={item.key} role="presentation">
                {showGroup ? <div className={classes.slashMenuGroup}>{item.group}</div> : null}
                <button
                  id={`${menuId}-${item.key}`}
                  ref={item.key === activeItem?.key ? activeOptionRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={item.key === activeItem?.key}
                  aria-disabled={!item.enabled}
                  disabled={!item.enabled}
                  className={classes.slashMenuItem}
                  data-testid={`tiptap-slash-item-${item.key}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(item)}
                >
                  <IconComponent size={18} aria-hidden />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.unavailableReason ?? item.subtext}</small>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
      <TiptapEmojiPicker
        opened={emojiContext !== undefined}
        title={messages.items.emoji.title}
        searchPlaceholder={messages.items.emoji.subtext}
        noResults={searchCombobox('noResults')}
        closeLabel={commonActions('close')}
        onClose={() => {
          setEmojiContext(undefined);
          editor.view.focus();
        }}
        onSelect={(name) => {
          const context = emojiContext;
          setEmojiContext(undefined);
          if (context) {
            applyTiptapSlashEmoji(editor, context, name);
          }
          editor.view.focus();
        }}
      />
    </>
  );
}
