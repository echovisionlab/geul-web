// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { MantineProvider } from '@mantine/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { createTiptapWireExtensions } from '../wire-schema';
import { canShowSelectionBubbleMenu } from '../menus/selection-bubble-commands';
import { CodeBlockSelectionMenu, type CodeBlockSelectionMenuLabels } from './CodeBlockSelectionMenu';

Object.defineProperties(Range.prototype, {
  getBoundingClientRect: { configurable: true, value: () => document.body.getBoundingClientRect() },
  getClientRects: { configurable: true, value: () => [document.body.getBoundingClientRect()] },
});
Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

const labels: CodeBlockSelectionMenuLabels = {
  menu: 'Code block',
  edit: 'Edit',
  source: 'Source',
  language: 'Language',
  languageNoResults: 'No languages found',
  copy: 'Copy',
  delete: 'Delete',
  alignment: 'Alignment',
  alignLeft: 'Left',
  alignCenter: 'Center',
  alignRight: 'Right',
  resizeLeft: 'Resize left',
  resizeRight: 'Resize right',
};

const cleanups: (() => Promise<void> | void)[] = [];

async function mount({ sole = false, authoringMode }: { sole?: boolean; authoringMode?: EditorAuthoringMode } = {}) {
  const editorElement = document.createElement('div');
  const menuElement = document.createElement('div');
  document.body.append(editorElement, menuElement);
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
              attrs: { id: 'code' },
              content: [
                {
                  type: 'codeBlock',
                  attrs: { language: 'javascript', previewWidth: '100', textAlignment: 'left' },
                  content: [{ type: 'text', text: 'let x = 1;' }],
                },
              ],
            },
            ...(sole
              ? []
              : [
                  {
                    type: 'blockContainer',
                    attrs: { id: 'after' },
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'after' }] }],
                  },
                ]),
          ],
        },
      ],
    },
  });
  let codePosition = -1;
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'codeBlock') {
      codePosition = position;
    }
  });
  editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, codePosition)));
  const root = createRoot(menuElement);
  await act(async () => {
    root.render(
      <MantineProvider env="test">
        <CodeBlockSelectionMenu
          editor={editor}
          authoringMode={
            authoringMode ?? {
              allowLocalizedBlockEdits: false,
              allowNeutralBlockEdits: true,
            }
          }
          labels={labels}
        />
      </MantineProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  cleanups.push(async () => {
    await act(async () => root.unmount());
    editor.destroy();
    editorElement.remove();
    menuElement.remove();
  });
  return { editor, codePosition, containerPosition: codePosition - 1 };
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    await cleanup();
  }
  vi.restoreAllMocks();
});

describe('CodeBlockSelectionMenu', () => {
  it('offers edit, alignment and delete in one keyboard toolbar', async () => {
    const applyNeutralBlockProps = vi.fn();
    const { editor, codePosition } = await mount({
      authoringMode: {
        allowLocalizedBlockEdits: false,
        allowNeutralBlockEdits: true,
        applyNeutralBlockProps,
      },
    });
    const toolbar = document.querySelector<HTMLElement>('[data-testid="tiptap-code-block-menu"]');
    expect(toolbar?.getAttribute('role')).toBe('toolbar');
    expect(canShowSelectionBubbleMenu(editor)).toBe(false);
    expect(document.querySelectorAll('[data-testid="tiptap-code-block-menu"]')).toHaveLength(1);
    expect(document.querySelector('[data-testid="tiptap-selection-menu"]')).toBeNull();
    const actions = toolbar?.querySelectorAll<HTMLElement>('[data-selection-toolbar-action]') ?? [];
    expect(actions).toHaveLength(5);
    expect(actions[0]?.getAttribute('data-testid')).toBe('tiptap-code-block-edit');

    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="tiptap-code-block-align-right"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(editor.state.doc.nodeAt(codePosition)?.attrs.textAlignment).toBe('right');
    expect(applyNeutralBlockProps).toHaveBeenCalledWith('code', { textAlignment: 'right' });
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);

    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    editor.view.dom.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(actions[0]);

    const selectionBeforeEscape = editor.state.selection.toJSON();
    const documentBeforeEscape = editor.state.doc.toJSON();
    await act(async () => {
      actions[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector('[data-testid="tiptap-code-block-menu"]')).toBeNull();
    expect(editor.state.selection.toJSON()).toEqual(selectionBeforeEscape);
    expect(editor.state.doc.toJSON()).toEqual(documentBeforeEscape);
    expect(document.activeElement).toBe(editor.view.dom);

    await act(async () => {
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, codePosition - 1)));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, codePosition)));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector('[data-testid="tiptap-code-block-menu"]')).not.toBeNull();
    await act(async () => {
      editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector('[data-testid="tiptap-code-block-menu"]')).toBeNull();
    expect(editor.state.selection.toJSON()).toEqual(selectionBeforeEscape);
    expect(editor.state.doc.toJSON()).toEqual(documentBeforeEscape);
  });

  it('does not open for the containing block selection because the code frame itself is not selected', async () => {
    const { editor, containerPosition } = await mount();
    await act(async () => {
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, containerPosition)));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector('[data-testid="tiptap-code-block-menu"]')).toBeNull();
  });

  it('hides for target-locale neutral lock and disables deletion for the sole top-level block', async () => {
    await mount({
      authoringMode: {
        allowLocalizedBlockEdits: true,
        allowNeutralBlockEdits: false,
      },
    });
    expect(document.querySelector('[data-testid="tiptap-code-block-menu"]')).toBeNull();

    await mount({ sole: true });
    expect(document.querySelector<HTMLButtonElement>('[data-testid="tiptap-code-block-delete"]')?.disabled).toBe(true);
  });
});
