'use client';

import { LayoutInline as LinkActions } from '@/components/core/Layout';
import { Separator } from '@/components/core/Display';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { ToolbarSurface } from '@/components/core/Section';
import { useCallback, useEffect, useMemo, useState, type MouseEvent, type PointerEvent } from 'react';
import type { Editor } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import type { Messages } from 'next-intl';
import { BubbleMenu, type BubbleMenuProps } from '@tiptap/react/menus';
import {
  IconCheck,
  IconDots,
  IconCode,
  IconIndentIncrease,
  IconIndentDecrease,
  IconStrikethrough,
  IconExternalLink,
  IconLink,
  IconLinkOff,
  IconMathFunction,
  IconPencil,
  IconSparkles,
  IconX,
} from '@tabler/icons-react';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { TextInput } from '@/components/core/Input';
import { Popover } from '@/components/core/Popover';
import { StandardFormattingButtons } from '@/features/editor/toolbars/FormattingButtons';
import { type EditorColor } from '@/features/editor/toolbars/EditorColorStyleButton';
import {
  EDITOR_TOOLBAR_SHORTCUTS,
  EditorToolbarDropdownTarget,
  EditorToolbarShortcutText,
} from '@/features/editor/toolbars/EditorToolbarTooltip';
import { EditorToolbarAction as Action } from '@/features/editor/toolbars/EditorToolbarAction';
import {
  canShowSelectionBubbleMenu,
  createSelectionBubbleMenuCommands,
  SELECTION_BLOCK_TYPES,
  type SelectionBlockType,
  type SelectionBubbleMenuCommandOptions,
  type SelectionBubbleMenuCommands,
  type SelectionRangeSnapshot,
  type SelectionTextStyle,
} from './selection-bubble-commands';
import {
  useTiptapBubbleMenu,
  useSelectionToolbarEditorTabBridge,
  useSelectionToolbarNavigation,
} from './useSelectionToolbarNavigation';
import classes from './SelectionBubbleMenu.module.css';

export const SELECTION_BUBBLE_MENU_PLUGIN_KEY = new PluginKey('tiptap-selection-menu');

export interface SelectionBubbleMenuLabels {
  menu: string;
  more?: string;
  blockType: string;
  blockTypes: Record<SelectionBlockType, string>;
  formatting: Record<SelectionTextStyle, string>;
  alignment: {
    group: string;
    left: string;
    center: string;
    right: string;
  };
  colors: {
    button: string;
    text: string;
    background: string;
    values: Record<EditorColor, string>;
  };
  nest: string;
  unnest: string;
  link: {
    create: string;
    open: string;
    edit: string;
    remove: string;
    url: string;
    text: string;
    textPlaceholder: string;
    urlPlaceholder: string;
    save: string;
    cancel: string;
  };
  inlineMath: string;
  ai: string;
}

export interface SelectionBubbleMenuProps extends SelectionBubbleMenuCommandOptions {
  editor: Editor;
  labels: SelectionBubbleMenuLabels;
}

export function createSelectionBubbleMenuLabels(
  messages: Messages['editorCommon']['editor'],
  actions: { save: string; cancel: string; more?: string },
): SelectionBubbleMenuLabels {
  return {
    menu: messages.formatting.blockType,
    more: actions.more,
    blockType: messages.formatting.blockType,
    blockTypes: {
      paragraph: messages.slashMenu.items.paragraph.title,
      'heading-1': messages.slashMenu.items.heading.title,
      'heading-2': messages.slashMenu.items.heading2.title,
      'heading-3': messages.slashMenu.items.heading3.title,
      bulletListItem: messages.slashMenu.items.bulletList.title,
      numberedListItem: messages.slashMenu.items.numberedList.title,
      checkListItem: messages.slashMenu.items.checkList.title,
      quote: messages.slashMenu.items.quote.title,
      codeBlock: messages.slashMenu.items.codeBlock.title,
    },
    formatting: {
      bold: messages.formatting.bold,
      italic: messages.formatting.italic,
      underline: messages.formatting.underline,
      strike: messages.formatting.strike,
      code: messages.formatting.code,
    },
    alignment: {
      group: messages.formatting.alignment,
      left: messages.formatting.alignLeft,
      center: messages.formatting.alignCenter,
      right: messages.formatting.alignRight,
    },
    colors: {
      button: messages.drag.colors,
      text: messages.colors.text,
      background: messages.colors.background,
      values: messages.colors.names,
    },
    nest: messages.formatting.nest,
    unnest: messages.formatting.unnest,
    link: {
      create: messages.link.create,
      open: messages.link.open,
      edit: messages.link.edit,
      remove: messages.link.remove,
      url: messages.link.urlPlaceholder,
      text: messages.link.titlePlaceholder,
      textPlaceholder: messages.link.titlePlaceholder,
      urlPlaceholder: messages.link.urlPlaceholder,
      save: actions.save,
      cancel: actions.cancel,
    },
    inlineMath: messages.formatting.inlineMath,
    ai: messages.formatting.ai,
  };
}

export const SELECTION_BUBBLE_MENU_CONTROL_ORDER = [
  'block-type',
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'alignment',
  'colors',
  'nest',
  'unnest',
  'link',
  'inline-math',
  'ai',
] as const;

const bubbleOptions: NonNullable<BubbleMenuProps['options']> = {
  placement: 'top',
  offset: 8,
  flip: true,
  shift: true,
};

function preserveSelection(event: MouseEvent | PointerEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('input, textarea, [contenteditable="true"]')) {
    event.preventDefault();
  }
}

function LinkEditor({
  commands,
  labels,
  mode,
  snapshot,
  onClose,
}: {
  commands: SelectionBubbleMenuCommands;
  labels: SelectionBubbleMenuLabels;
  mode: 'create' | 'edit';
  snapshot: SelectionRangeSnapshot;
  onClose: () => void;
}) {
  const [href, setHref] = useState(mode === 'edit' ? (commands.linkHref ?? '') : '');
  const [text, setText] = useState(commands.selectedText);
  const [isComposing, setIsComposing] = useState(false);
  const save = () => {
    const value = href.trim();
    if (!value) {
      return;
    }
    const input = { href: value, text };
    const applied = mode === 'edit' ? commands.editLink(input, snapshot) : commands.createLink(input, snapshot);
    if (applied) {
      onClose();
    }
  };
  return (
    <form
      className={classes.linkEditor}
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
          event.preventDefault();
          onClose();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (isComposing) {
          return;
        }
        save();
      }}
    >
      <TextInput
        size="xs"
        label={labels.link.text}
        placeholder={labels.link.textPlaceholder}
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
      />
      <TextInput
        autoFocus
        size="xs"
        label={labels.link.url}
        placeholder={labels.link.urlPlaceholder}
        value={href}
        onChange={(event) => setHref(event.currentTarget.value)}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) {
            if (event.key === 'Enter') {
              event.preventDefault();
            }
          }
        }}
      />
      <Button type="submit" size="xs" disabled={!href.trim()} leftSection={<IconCheck size={14} />}>
        {labels.link.save}
      </Button>
      <Button type="button" size="xs" tone="neutral" emphasis="low" leftSection={<IconX size={14} />} onClick={onClose}>
        {labels.link.cancel}
      </Button>
    </form>
  );
}

function LinkControls({
  commands,
  labels,
  snapshot,
}: {
  commands: SelectionBubbleMenuCommands;
  labels: SelectionBubbleMenuLabels;
  snapshot: SelectionRangeSnapshot;
}) {
  const [mode, setMode] = useState<'create' | 'edit' | null>(null);
  const close = () => setMode(null);
  if (!commands.linkHref) {
    return (
      <Popover
        open={mode === 'create'}
        onOpenChange={(open) => setMode(open ? 'create' : null)}
        portal={false}
        size="wide"
      >
        <Action
          popoverTarget
          label={labels.link.create}
          testId="tiptap-selection-link-create"
          onClick={() => setMode('create')}
        >
          <IconLink size={16} />
        </Action>
        <Popover.Dropdown padding="compact">
          <LinkEditor commands={commands} labels={labels} mode="create" snapshot={snapshot} onClose={close} />
        </Popover.Dropdown>
      </Popover>
    );
  }
  return (
    <LinkActions gap="xxs" wrap="nowrap" role="group" aria-label={labels.link.edit}>
      <Popover open={mode === 'edit'} onOpenChange={(open) => setMode(open ? 'edit' : null)} portal={false} size="wide">
        <Action
          popoverTarget
          label={labels.link.edit}
          testId="tiptap-selection-link-edit"
          onClick={() => setMode('edit')}
        >
          <IconPencil size={16} />
        </Action>
        <Popover.Dropdown padding="compact">
          <LinkEditor commands={commands} labels={labels} mode="edit" snapshot={snapshot} onClose={close} />
        </Popover.Dropdown>
      </Popover>
    </LinkActions>
  );
}

export function SelectionBubbleMenuView({
  commands,
  labels,
  selectionSnapshot = { from: 0, to: 0 },
  onEscapeFocus,
  editorElement = null,
  navigationEnabled = false,
}: {
  commands: SelectionBubbleMenuCommands;
  labels: SelectionBubbleMenuLabels;
  selectionSnapshot?: SelectionRangeSnapshot;
  onEscapeFocus?: () => void;
  editorElement?: HTMLElement | null;
  navigationEnabled?: boolean;
}) {
  const navigation = useSelectionToolbarNavigation({ onEscape: onEscapeFocus });
  useSelectionToolbarEditorTabBridge(editorElement, navigation.focusFirstAction, navigationEnabled, onEscapeFocus);
  const linkSelection = commands.linkSelection ?? selectionSnapshot;
  const hasFormattingControls = commands.hasTextSelection || commands.canAlign;
  const hasLinkControls = (commands.hasSafeInlineSelection && !commands.inlineCodeActive) || Boolean(commands.linkHref);
  const hasContextualControls = hasLinkControls || commands.canConvertToInlineMath || commands.canOpenAI;
  return (
    <div className={classes.menu}>
      <ToolbarSurface
        ref={navigation.toolbarRef}
        density="compact"
        wrap="nowrap"
        label={labels.menu}
        data-testid="tiptap-selection-menu"
        onMouseDownCapture={preserveSelection}
        onPointerDownCapture={preserveSelection}
        onKeyDownCapture={navigation.onToolbarKeyDown}
        onFocusCapture={navigation.onToolbarFocusCapture}
      >
        <StandardFormattingButtons
          textStyles={['bold', 'italic', 'underline']}
          labels={{
            bold: labels.formatting.bold,
            italic: labels.formatting.italic,
            underline: labels.formatting.underline,
            strike: labels.formatting.strike,
            code: labels.formatting.code,
            link: labels.link.create,
            nest: labels.nest,
            unnest: labels.unnest,
            alignment: labels.alignment.group,
          }}
          blockType={
            commands.hasTextSelection
              ? {
                  label: labels.blockType,
                  value: commands.blockType ?? '',
                  options: SELECTION_BLOCK_TYPES.map((type) => ({ value: type, label: labels.blockTypes[type] })),
                  onChange: (value) => commands.setBlockType(value as SelectionBlockType),
                  disabled: !commands.canChangeBlockType,
                }
              : undefined
          }
          alignment={
            commands.canAlign
              ? {
                  value: commands.alignment,
                  presentation: 'menu',
                  labels: labels.alignment,
                  onChange: commands.setAlignment,
                }
              : undefined
          }
          color={
            commands.hasTextSelection
              ? {
                  labels: {
                    button: labels.colors.button,
                    text: labels.colors.text,
                    background: labels.colors.background,
                    colors: labels.colors.values,
                  },
                  textColor: commands.textColor,
                  backgroundColor: commands.backgroundColor,
                  onTextColorChange: commands.setTextColor,
                  onBackgroundColorChange: commands.setBackgroundColor,
                  disabled: commands.inlineCodeActive || !commands.canColor,
                }
              : undefined
          }
          activeTextStyles={commands.activeTextStyles}
          onToggleTextStyle={commands.hasTextSelection ? commands.toggleTextStyle : undefined}
          textStylesDisabled={!commands.canFormatText}
          nestDisabled={!commands.canNest}
          unnestDisabled={!commands.canUnnest}
        />
        {hasFormattingControls && hasContextualControls ? <Separator orientation="vertical" aria-hidden /> : null}
        {hasLinkControls ? <LinkControls commands={commands} labels={labels} snapshot={linkSelection} /> : null}
        <DropdownMenu placement="bottom-end" size="compact">
          <EditorToolbarDropdownTarget label={labels.more ?? labels.menu} focusHint={false}>
            {(targetRef) => (
              <IconButton
                ref={targetRef}
                label={labels.more ?? labels.menu}
                data-selection-toolbar-action=""
                data-testid="tiptap-selection-more"
                onMouseDown={preserveSelection}
              >
                <IconDots size={16} />
              </IconButton>
            )}
          </EditorToolbarDropdownTarget>
          <DropdownMenu.Dropdown>
            {commands.linkHref ? (
              <>
                <DropdownMenu.Item icon={<IconExternalLink size={16} />} onClick={commands.openLink}>
                  {labels.link.open}
                </DropdownMenu.Item>
                <DropdownMenu.Item icon={<IconLinkOff size={16} />} onClick={commands.removeLink}>
                  {labels.link.remove}
                </DropdownMenu.Item>
              </>
            ) : null}
            {commands.hasTextSelection ? (
              <>
                <DropdownMenu.Item
                  selected={commands.activeTextStyles.has('strike')}
                  disabled={!commands.canFormatText}
                  icon={<IconStrikethrough size={16} />}
                  onClick={() => commands.toggleTextStyle('strike')}
                >
                  {labels.formatting.strike}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  selected={commands.activeTextStyles.has('code')}
                  disabled={!commands.canFormatText}
                  icon={<IconCode size={16} />}
                  onClick={() => commands.toggleTextStyle('code')}
                >
                  {labels.formatting.code}
                </DropdownMenu.Item>
              </>
            ) : null}
            {commands.canNest ? (
              <DropdownMenu.Item icon={<IconIndentIncrease size={16} />} onClick={commands.nest}>
                {labels.nest}
              </DropdownMenu.Item>
            ) : null}
            {commands.canUnnest ? (
              <DropdownMenu.Item icon={<IconIndentDecrease size={16} />} onClick={commands.unnest}>
                {labels.unnest}
              </DropdownMenu.Item>
            ) : null}
            {commands.canConvertToInlineMath ? (
              <DropdownMenu.Item icon={<IconMathFunction size={16} />} onClick={commands.convertToInlineMath}>
                {labels.inlineMath}
              </DropdownMenu.Item>
            ) : null}
            {commands.canOpenAI ? (
              <DropdownMenu.Item icon={<IconSparkles size={16} />} onClick={commands.openAI}>
                <LinkActions gap="md" justify="between">
                  <span>{labels.ai}</span>
                  <EditorToolbarShortcutText shortcut={EDITOR_TOOLBAR_SHORTCUTS.ai} />
                </LinkActions>
              </DropdownMenu.Item>
            ) : null}
          </DropdownMenu.Dropdown>
        </DropdownMenu>
      </ToolbarSurface>
    </div>
  );
}

function hasFocusedOwnedPopup(element: HTMLElement): boolean {
  const focused = element.ownerDocument.activeElement;
  if (!focused) {
    return false;
  }
  return [...element.querySelectorAll<HTMLElement>('[aria-controls]')].some((trigger) =>
    (trigger.getAttribute('aria-controls')?.split(/\s+/).filter(Boolean) ?? []).some((id) =>
      element.ownerDocument.getElementById(id)?.contains(focused),
    ),
  );
}

export const shouldShowSelectionBubbleMenu: NonNullable<BubbleMenuProps['shouldShow']> = ({ editor, element, view }) =>
  canShowSelectionBubbleMenu(editor) &&
  (view.hasFocus() || element.contains(element.ownerDocument.activeElement) || hasFocusedOwnedPopup(element));

export function updateSelectionBubbleMenuPosition(editor: Editor) {
  if (editor.isDestroyed || !canShowSelectionBubbleMenu(editor)) {
    return false;
  }
  editor.view.dispatch(
    editor.state.tr.setMeta(SELECTION_BUBBLE_MENU_PLUGIN_KEY, 'updatePosition').setMeta('addToHistory', false),
  );
  return true;
}

/** Contextual selected-text controls; never rendered as a fixed editor toolbar. */
export function TiptapSelectionBubbleMenu({ editor, labels, onAIActivate, onOpenLink }: SelectionBubbleMenuProps) {
  const [revision, setRevision] = useState(0);
  const menu = useTiptapBubbleMenu(editor, SELECTION_BUBBLE_MENU_PLUGIN_KEY);
  useEffect(() => {
    let positionFrame = 0;
    const refreshSelection = () => {
      setRevision((revision) => revision + 1);
      cancelAnimationFrame(positionFrame);
      positionFrame = requestAnimationFrame(() => updateSelectionBubbleMenuPosition(editor));
    };
    const refreshTransaction = () => setRevision((revision) => revision + 1);
    editor.on('selectionUpdate', refreshSelection);
    editor.on('transaction', refreshTransaction);
    return () => {
      cancelAnimationFrame(positionFrame);
      editor.off('selectionUpdate', refreshSelection);
      editor.off('transaction', refreshTransaction);
    };
  }, [editor]);
  const commands = useMemo(
    () => createSelectionBubbleMenuCommands(editor, { onAIActivate, onOpenLink }),
    [editor, onAIActivate, onOpenLink, revision],
  );
  const shouldShow = useCallback(
    (props: Parameters<NonNullable<BubbleMenuProps['shouldShow']>>[0]) =>
      !menu.isSuppressed && shouldShowSelectionBubbleMenu(props),
    [menu.isSuppressed],
  );
  if (!editor.isEditable || menu.isSuppressed) {
    return null;
  }
  const selectionSnapshot = {
    from: editor.state.selection.from,
    to: editor.state.selection.to,
    expectedText: editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, '\n', '\n'),
  };
  return (
    <BubbleMenu
      editor={editor}
      pluginKey={SELECTION_BUBBLE_MENU_PLUGIN_KEY}
      updateDelay={0}
      shouldShow={shouldShow}
      options={bubbleOptions}
    >
      <SelectionBubbleMenuView
        commands={commands}
        labels={labels}
        selectionSnapshot={selectionSnapshot}
        onEscapeFocus={menu.hide}
        editorElement={editor.view.dom}
        navigationEnabled={canShowSelectionBubbleMenu(editor)}
      />
    </BubbleMenu>
  );
}
