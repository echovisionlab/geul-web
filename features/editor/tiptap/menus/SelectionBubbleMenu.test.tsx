// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act, type ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRoot, type Root } from 'react-dom/client';

import { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';
import {
  SELECTION_BUBBLE_MENU_PLUGIN_KEY,
  SelectionBubbleMenuView,
  shouldShowSelectionBubbleMenu,
  updateSelectionBubbleMenuPosition,
  type SelectionBubbleMenuLabels,
} from './SelectionBubbleMenu';
import { createSelectionBubbleMenuCommands, type SelectionBubbleMenuCommands } from './selection-bubble-commands';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Win32');
  vi.spyOn(window.navigator, 'maxTouchPoints', 'get').mockReturnValue(0);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<DesignSystemProvider forceColorScheme="light">{node}</DesignSystemProvider>));
}

const labels: SelectionBubbleMenuLabels = {
  menu: 'Formatting',
  more: 'Options',
  blockType: 'Block type',
  blockTypes: {
    paragraph: 'Paragraph',
    'heading-1': 'Heading 1',
    'heading-2': 'Heading 2',
    'heading-3': 'Heading 3',
    bulletListItem: 'Bulleted list',
    numberedListItem: 'Numbered list',
    checkListItem: 'Checklist',
    quote: 'Quote',
    codeBlock: 'Code block',
  },
  formatting: { bold: 'Bold', italic: 'Italic', underline: 'Underline', strike: 'Strike', code: 'Code' },
  alignment: { group: 'Alignment', left: 'Align left', center: 'Align center', right: 'Align right' },
  colors: {
    button: 'Colors',
    text: 'Text',
    background: 'Background',
    values: {
      default: 'Default',
      gray: 'Gray',
      brown: 'Brown',
      red: 'Red',
      orange: 'Orange',
      yellow: 'Yellow',
      green: 'Green',
      blue: 'Blue',
      purple: 'Purple',
      pink: 'Pink',
    },
  },
  nest: 'Nest',
  unnest: 'Unnest',
  link: {
    create: 'Create link',
    open: 'Open link',
    edit: 'Edit link',
    remove: 'Remove link',
    url: 'URL',
    text: 'Text',
    textPlaceholder: 'Text',
    urlPlaceholder: 'URL',
    save: 'Save',
    cancel: 'Cancel',
  },
  inlineMath: 'Inline math',
};

function commands(overrides: Partial<SelectionBubbleMenuCommands> = {}): SelectionBubbleMenuCommands {
  return {
    blockType: 'paragraph',
    canChangeBlockType: true,
    activeTextStyles: new Set(),
    alignment: 'left',
    canAlign: true,
    canFormatText: true,
    canColor: true,
    textColor: 'default',
    backgroundColor: 'default',
    canNest: false,
    canUnnest: false,
    linkHref: null,
    linkSelection: null,
    canConvertToInlineMath: false,
    hasTextSelection: true,
    hasSafeInlineSelection: true,
    inlineCodeActive: false,
    selectedText: 'selected',
    setBlockType: () => true,
    toggleTextStyle: () => true,
    setAlignment: () => true,
    setTextColor: () => true,
    setBackgroundColor: () => true,
    nest: () => false,
    unnest: () => false,
    createLink: () => true,
    editLink: () => true,
    openLink: () => true,
    removeLink: () => true,
    convertToInlineMath: () => false,
    ...overrides,
  };
}

describe('SelectionBubbleMenuView keyboard navigation', () => {
  it('keeps desktop link action labels out of shrinkable grid tracks', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'features/editor/tiptap/menus/SelectionBubbleMenu.module.css'),
      'utf8',
    );

    expect(css).toContain('minmax(0, 1fr) minmax(0, 1.4fr) max-content max-content');
    expect(css).toMatch(/\.linkEditorAction\s*\{[^}]*min-width:\s*max-content;/u);
  });

  it('uses one tab stop and wraps visible enabled controls with arrow, Home, and End', () => {
    render(<SelectionBubbleMenuView commands={commands()} labels={labels} />);
    const toolbar = container!.querySelector<HTMLElement>('[role="toolbar"]')!;
    const controls = [...toolbar.querySelectorAll<HTMLButtonElement>('[data-selection-toolbar-action]:not(:disabled)')];
    const firstControl = controls[0]!;
    const lastControl = controls[controls.length - 1]!;

    expect(controls.length).toBeGreaterThan(3);
    expect(controls.filter((control) => control.tabIndex === 0)).toHaveLength(1);
    act(() => firstControl.focus());
    act(() => firstControl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
    expect(document.activeElement).toBe(lastControl);
    act(() => lastControl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    expect(document.activeElement).toBe(firstControl);
    act(() => firstControl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(document.activeElement).toBe(lastControl);
  });

  it.each([
    { linkHref: null, targetId: 'tiptap-selection-link-create' },
    { linkHref: 'https://example.invalid', targetId: 'tiptap-selection-link-edit' },
  ])('puts link disclosure and focus on the actual button: $targetId', async ({ linkHref, targetId }) => {
    render(<SelectionBubbleMenuView commands={commands({ linkHref })} labels={labels} />);
    const toolbar = container!.querySelector<HTMLElement>('[role="toolbar"]')!;
    const target = toolbar.querySelector<HTMLButtonElement>(`[data-testid="${targetId}"]`)!;
    expect(target.tagName).toBe('BUTTON');
    expect(target.getAttribute('aria-expanded')).toBe('false');
    expect(toolbar.querySelector('span[aria-expanded], span[tabindex="0"]')).toBeNull();
    await act(async () => target.click());
    expect(target.getAttribute('aria-expanded')).toBe('true');
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    const input = dialog.querySelector<HTMLInputElement>('input')!;
    await act(async () => {
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(target.getAttribute('aria-expanded')).toBe('false');
  });

  it('restores editor focus on Escape without hijacking arrow keys from form inputs', () => {
    const onEscapeFocus = vi.fn();
    render(
      <SelectionBubbleMenuView
        commands={commands({ linkHref: 'https://example.invalid', selectedText: 'Geul' })}
        labels={labels}
        onEscapeFocus={onEscapeFocus}
      />,
    );
    const toolbar = container!.querySelector<HTMLElement>('[role="toolbar"]')!;
    const input = document.createElement('input');
    toolbar.appendChild(input);
    act(() => input.focus());
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(document.activeElement).toBe(input);
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onEscapeFocus).not.toHaveBeenCalled();
    const action = toolbar.querySelector<HTMLButtonElement>('[data-selection-toolbar-action]')!;
    act(() => action.focus());
    act(() => action.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onEscapeFocus).toHaveBeenCalledOnce();
  });

  it('shows every available control in the established order, with secondary commands behind More', async () => {
    render(
      <SelectionBubbleMenuView
        commands={commands({ canNest: true, canUnnest: true, canConvertToInlineMath: true })}
        labels={labels}
      />,
    );
    const toolbar = container!.querySelector<HTMLElement>('[role="toolbar"]')!;

    expect(
      [...toolbar.querySelectorAll<HTMLElement>('[data-selection-toolbar-action]')].map((control) =>
        control.getAttribute('aria-label'),
      ),
    ).toEqual([
      'Block type',
      'Bold',
      'Italic',
      'Underline',
      'Alignment',
      'Text',
      'Background',
      'Create link',
      'Options',
    ]);
    await act(async () => toolbar.querySelector<HTMLButtonElement>('[data-testid="tiptap-selection-more"]')!.click());
    expect([...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].map((item) => item.textContent)).toEqual([
      'Strike',
      'Code',
      'Nest',
      'Unnest',
      'Inline math',
    ]);
  });

  it('keeps secondary formatting commands in the actual compact menu', async () => {
    const toggleTextStyle = vi.fn(() => true);
    render(
      <SelectionBubbleMenuView
        commands={commands({ canConvertToInlineMath: true, toggleTextStyle })}
        labels={labels}
      />,
    );
    const toolbar = container!.querySelector<HTMLElement>('[role="toolbar"]')!;
    expect(toolbar.getAttribute('data-geul-toolbar-density')).toBe('compact');
    expect(toolbar.querySelectorAll('[data-selection-toolbar-action]')).toHaveLength(9);
    expect(toolbar.querySelector('button[aria-label="Strike"]')).toBeNull();
    await act(async () => toolbar.querySelector<HTMLButtonElement>('[data-testid="tiptap-selection-more"]')!.click());
    const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(items.some((item) => item.textContent === 'Inline math')).toBe(true);
    await act(async () =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
        .find((item) => item.textContent === 'Code')!
        .click(),
    );
    expect(toggleTextStyle).toHaveBeenCalledWith('code');
  });

  it('portals More outside the scrolling rail while preserving editor selection and owned popup focus', async () => {
    const editorElement = document.createElement('div');
    document.body.append(editorElement);
    const editor = new Editor({
      element: editorElement,
      extensions: createTiptapWireExtensions(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [
              {
                type: 'blockContainer',
                attrs: { id: 'portal-selection' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'selected word' }] }],
              },
            ],
          },
        ],
      },
    });
    try {
      let position = 0;
      editor.state.doc.descendants((node, offset) => {
        if (node.type.name === 'paragraph') {
          position = offset;
        }
      });
      editor.view.dispatch(
        editor.state.tr.setSelection(TextSelection.create(editor.state.doc, position + 1, position + 9)),
      );
      const selection = editor.state.selection;
      const onEscapeFocus = vi.fn();
      render(
        <SelectionBubbleMenuView
          commands={createSelectionBubbleMenuCommands(editor)}
          labels={labels}
          onEscapeFocus={onEscapeFocus}
        />,
      );
      const toolbar = container!.querySelector<HTMLElement>('[role="toolbar"]')!;
      const trigger = toolbar.querySelector<HTMLButtonElement>('[data-testid="tiptap-selection-more"]')!;
      await act(async () => {
        trigger.focus();
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      });
      const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
      expect(menu).not.toBeNull();
      expect(toolbar.contains(menu)).toBe(false);
      expect(container!.contains(menu)).toBe(false);
      expect(trigger.getAttribute('aria-controls')).toBe(menu.id);
      expect(menu.contains(document.activeElement)).toBe(true);
      expect(editor.state.selection.eq(selection)).toBe(true);
      expect(
        shouldShowSelectionBubbleMenu({ editor, element: toolbar.parentElement!, view: editor.view } as Parameters<
          typeof shouldShowSelectionBubbleMenu
        >[0]),
      ).toBe(true);
      await act(async () =>
        menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })),
      );
      expect(document.querySelector('[role="menu"]')).toBeNull();
      await act(async () => {
        // React Aria restores the trigger in the frame after the popup unmounts.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      });
      expect(document.activeElement).toBe(trigger);
      expect(onEscapeFocus).not.toHaveBeenCalled();
      expect(editor.state.selection.eq(selection)).toBe(true);
    } finally {
      await act(async () => {
        editor.destroy();
        editorElement.remove();
      });
    }
  });

  it('offers one alignment trigger while its three actual menu commands remain available', async () => {
    const setAlignment = vi.fn(() => true);
    render(<SelectionBubbleMenuView commands={commands({ setAlignment })} labels={labels} />);
    const toolbar = container!.querySelector<HTMLElement>('[role="toolbar"]')!;
    expect(toolbar.querySelector('button[aria-label="Align center"]')).toBeNull();
    const trigger = toolbar.querySelector<HTMLButtonElement>('button[aria-label="Alignment"]')!;
    await act(async () => trigger.click());
    const center = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent === 'Align center',
    )!;
    await act(async () => center.click());
    expect(setAlignment).toHaveBeenCalledWith('center');
  });
});

describe('SelectionBubbleMenu positioning and dismissal', () => {
  it('requests the current selection position with a history-free metadata transaction', () => {
    const editorElement = document.createElement('div');
    document.body.appendChild(editorElement);
    const editor = new Editor({
      element: editorElement,
      extensions: createTiptapWireExtensions(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [
              {
                type: 'blockContainer',
                attrs: { id: 'position-refresh' },
                content: [
                  {
                    type: 'paragraph',
                    attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
                    content: [{ type: 'text', text: 'selected word' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    let paragraphPosition = -1;
    editor.state.doc.descendants((node, position) => {
      if (paragraphPosition < 0 && node.type.name === 'paragraph') {
        paragraphPosition = position;
      }
    });
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, paragraphPosition + 1, paragraphPosition + 9),
      ),
    );
    const beforeDocument = editor.state.doc;
    const beforeSelection = editor.state.selection;
    const transactions: Array<{ positionMeta: unknown; addToHistory: unknown }> = [];
    editor.on('transaction', ({ transaction }) =>
      transactions.push({
        positionMeta: transaction.getMeta(SELECTION_BUBBLE_MENU_PLUGIN_KEY),
        addToHistory: transaction.getMeta('addToHistory'),
      }),
    );

    expect(updateSelectionBubbleMenuPosition(editor)).toBe(true);
    expect(transactions).toEqual([{ positionMeta: 'updatePosition', addToHistory: false }]);
    expect(editor.state.doc).toBe(beforeDocument);
    expect(editor.state.selection.eq(beforeSelection)).toBe(true);

    editor.destroy();
    editorElement.remove();
  });
});
