// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';
import {
  SELECTION_BUBBLE_MENU_PLUGIN_KEY,
  SelectionBubbleMenuView,
  updateSelectionBubbleMenuPosition,
  type SelectionBubbleMenuLabels,
} from './SelectionBubbleMenu';
import type { SelectionBubbleMenuCommands } from './selection-bubble-commands';

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
  act(() => root?.render(<MantineProvider env="test">{node}</MantineProvider>));
}

const labels: SelectionBubbleMenuLabels = {
  menu: 'Formatting',
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
  ai: 'AI',
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
    canOpenAI: false,
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
    openAI: () => false,
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
    expect(onEscapeFocus).toHaveBeenCalledOnce();
  });

  it('shows only the real AI shortcut while inline math keeps a name-only tooltip', () => {
    render(
      <SelectionBubbleMenuView
        commands={commands({ canConvertToInlineMath: true, canOpenAI: true })}
        labels={labels}
      />,
    );
    const ai = container!.querySelector<HTMLButtonElement>('[data-testid="tiptap-selection-ai"]')!;
    act(() => ai.focus());
    expect(ai.getAttribute('aria-label')).toBe('AI');
    expect(
      [...document.querySelectorAll<HTMLElement>('[data-editor-toolbar-tooltip-content]')]
        .find((content) => content.textContent?.startsWith('AI'))
        ?.querySelector('kbd')?.textContent,
    ).toBe('Ctrl J');

    const inlineMath = container!.querySelector<HTMLButtonElement>('[data-testid="tiptap-selection-inline-math"]')!;
    act(() => inlineMath.focus());
    expect(
      [...document.querySelectorAll<HTMLElement>('[data-editor-toolbar-tooltip-content]')]
        .find((content) => content.textContent === 'Inline math')
        ?.querySelector('kbd'),
    ).toBeNull();
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
