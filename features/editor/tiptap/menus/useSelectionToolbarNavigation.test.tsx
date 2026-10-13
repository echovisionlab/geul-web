// @vitest-environment jsdom

import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Editor, type JSONContent } from '@tiptap/core';
import { PluginKey, TextSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';
import {
  useSelectionToolbarEditorTabBridge,
  useSelectionToolbarNavigation,
  useTiptapBubbleMenu,
} from './useSelectionToolbarNavigation';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
}

function Fixture({
  onEscape,
  vertical = false,
  bridgeEnabled = true,
}: {
  onEscape?: () => void;
  vertical?: boolean;
  bridgeEnabled?: boolean;
}) {
  const [editor, setEditor] = useState<HTMLElement | null>(null);
  const navigation = useSelectionToolbarNavigation({ onEscape, enableVerticalArrows: vertical });
  useSelectionToolbarEditorTabBridge(editor, navigation.focusFirstAction, bridgeEnabled, onEscape);
  return (
    <>
      <div ref={setEditor} data-editor contentEditable suppressContentEditableWarning>
        Hello
        <input data-editor-input aria-label="Nested editor input" />
        <div data-testid="tiptap-monaco-source-editor" data-source-editor="monaco" contentEditable={false}>
          <button type="button" data-monaco-edit-context />
        </div>
      </div>
      <button type="button" data-drag-handle tabIndex={-1}>
        Block grip
      </button>
      <button type="button" data-native-next>
        Next native target
      </button>
      <div
        ref={navigation.toolbarRef}
        role="toolbar"
        onKeyDownCapture={navigation.onToolbarKeyDown}
        onFocusCapture={navigation.onToolbarFocusCapture}
      >
        <button
          type="button"
          data-selection-toolbar-action
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
            }
          }}
        >
          First
        </button>
        <button type="button" data-selection-toolbar-action aria-disabled="true">
          ARIA disabled
        </button>
        <button type="button" data-selection-toolbar-action disabled>
          Disabled
        </button>
        <button type="button" data-selection-toolbar-action hidden>
          Hidden
        </button>
        <button type="button" data-selection-toolbar-action style={{ display: 'none' }}>
          CSS hidden
        </button>
        <button type="button" data-selection-toolbar-action>
          Last
        </button>
        <input aria-label="Native input" tabIndex={-1} />
        <form>
          <button type="button" data-link-popup-action>
            Link popup action
          </button>
        </form>
        <div role="menu">
          <button type="button" role="menuitem" data-color-popup-action>
            Color popup action
          </button>
        </div>
      </div>
    </>
  );
}

describe('useSelectionToolbarNavigation', () => {
  it('keeps the container non-focusable and one enabled visible action tabbable', () => {
    render(<Fixture />);
    const toolbar = container!.querySelector<HTMLElement>('[role="toolbar"]')!;
    const actions = [...toolbar.querySelectorAll<HTMLElement>('[data-selection-toolbar-action]')];
    expect(toolbar.hasAttribute('tabindex')).toBe(false);
    expect(actions.map((action) => action.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);
  });

  it('wraps horizontal arrows, supports Home/End, and leaves native input arrows alone', () => {
    render(<Fixture />);
    const toolbar = container!.querySelector<HTMLElement>('[role="toolbar"]')!;
    const actions = [...toolbar.querySelectorAll<HTMLButtonElement>('[data-selection-toolbar-action]')].filter(
      (action) => action.textContent === 'First' || action.textContent === 'Last',
    );
    const input = toolbar.querySelector<HTMLInputElement>('input')!;
    act(() => actions[0]!.focus());
    act(() => actions[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
    expect(document.activeElement).toBe(actions[1]);
    act(() => actions[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    expect(document.activeElement).toBe(actions[0]);
    act(() => actions[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(document.activeElement).toBe(actions[1]);
    act(() => input.focus());
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(document.activeElement).toBe(input);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => actions[0]!.dispatchEvent(enter));
    expect(enter.defaultPrevented).toBe(false);
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    act(() => actions[0]!.dispatchEvent(space));
    expect(space.defaultPrevented).toBe(false);
  });

  it('leaves Tab and Shift+Tab native on every toolbar action and input', () => {
    render(<Fixture />);
    const toolbar = container!.querySelector<HTMLElement>('[role="toolbar"]')!;
    const actions = [...toolbar.querySelectorAll<HTMLButtonElement>('[data-selection-toolbar-action]')].filter(
      (action) => action.textContent === 'First' || action.textContent === 'Last',
    );
    const input = toolbar.querySelector<HTMLInputElement>('input')!;
    for (const target of [...actions, input]) {
      act(() => target.focus());
      for (const shiftKey of [false, true]) {
        const tab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
        act(() => target.dispatchEvent(tab));
        expect(tab.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(target);
      }
    }
  });

  it('leaves the only visible action with Tab instead of trapping focus', () => {
    render(<Fixture />);
    const actions = [...container!.querySelectorAll<HTMLButtonElement>('[data-selection-toolbar-action]')].filter(
      (action) => action.textContent === 'First' || action.textContent === 'Last',
    );
    actions[1]!.hidden = true;
    act(() => actions[0]!.focus());
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => actions[0]!.dispatchEvent(tab));
    expect(tab.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(actions[0]);
  });

  it('preserves IME and modified navigation rather than moving toolbar focus', () => {
    const onEscape = vi.fn();
    render(<Fixture onEscape={onEscape} />);
    const first = container!.querySelector<HTMLButtonElement>('[data-selection-toolbar-action]')!;
    act(() => first.focus());
    for (const options of [{ isComposing: true }, { altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      for (const key of ['Escape', 'ArrowRight', 'Home', 'End']) {
        const event = new KeyboardEvent('keydown', { ...options, key, bubbles: true, cancelable: true });
        act(() => first.dispatchEvent(event));
        expect(event.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(first);
      }
    }
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('uses vertical arrows only when explicitly enabled', () => {
    render(<Fixture vertical />);
    const actions = [...container!.querySelectorAll<HTMLButtonElement>('[data-selection-toolbar-action]')].filter(
      (action) => action.textContent === 'First' || action.textContent === 'Last',
    );
    act(() => actions[0]!.focus());
    act(() => actions[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(document.activeElement).toBe(actions[1]);
  });

  it('lets nested link forms, menus and input controls own Escape before the toolbar dismisses', () => {
    const onEscape = vi.fn();
    render(<Fixture onEscape={onEscape} />);
    for (const selector of ['[data-link-popup-action]', '[data-color-popup-action]', '[aria-label="Native input"]']) {
      const target = container!.querySelector<HTMLElement>(selector)!;
      act(() => target.focus());
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      act(() => target.dispatchEvent(event));
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(target);
    }
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('calls Escape and bridges editor Tab directly to the first action', () => {
    const onEscape = vi.fn();
    render(<Fixture onEscape={onEscape} />);
    const editor = container!.querySelector<HTMLElement>('[data-editor]')!;
    const first = container!.querySelector<HTMLButtonElement>('[data-selection-toolbar-action]')!;
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => editor.dispatchEvent(tab));
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    const reverseTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    act(() => editor.dispatchEvent(reverseTab));
    expect(reverseTab.defaultPrevented).toBe(false);
    act(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onEscape).toHaveBeenCalledOnce();

    act(() => editor.focus());
    first.style.display = 'none';
    const last = container!.querySelector<HTMLButtonElement>('[data-selection-toolbar-action]:last-of-type')!;
    const nextTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => editor.dispatchEvent(nextTab));
    expect(document.activeElement).toBe(last);
    expect(first.tabIndex).toBe(-1);

    container!.querySelectorAll('[data-selection-toolbar-action]').forEach((action) => action.remove());
    const unsupportedTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => editor.dispatchEvent(unsupportedTab));
    expect(unsupportedTab.defaultPrevented).toBe(false);
    expect(container!.querySelector<HTMLButtonElement>('[data-drag-handle]')?.tabIndex).toBe(-1);
    expect(container!.querySelector<HTMLButtonElement>('[data-native-next]')?.tabIndex).toBe(0);
  });

  it('handles eligible editor-root Escape once and passes ineligible, form, and IME events through', () => {
    const onEscape = vi.fn();
    render(<Fixture onEscape={onEscape} />);
    const editor = container!.querySelector<HTMLElement>('[data-editor]')!;
    const input = editor.querySelector<HTMLInputElement>('[data-editor-input]')!;
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => editor.dispatchEvent(escape));
    expect(escape.defaultPrevented).toBe(true);
    expect(onEscape).toHaveBeenCalledOnce();

    const inputEscape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => input.dispatchEvent(inputEscape));
    expect(inputEscape.defaultPrevented).toBe(false);
    expect(onEscape).toHaveBeenCalledOnce();

    const monaco = editor.querySelector<HTMLElement>('[data-monaco-edit-context]')!;
    const monacoEscape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => monaco.dispatchEvent(monacoEscape));
    expect(monacoEscape.defaultPrevented).toBe(false);
    expect(onEscape).toHaveBeenCalledOnce();
    const monacoTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => monaco.dispatchEvent(monacoTab));
    expect(monacoTab.defaultPrevented).toBe(false);
    expect(document.activeElement).not.toBe(
      container!.querySelector<HTMLButtonElement>('[data-selection-toolbar-action]'),
    );

    const composingEscape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
      isComposing: true,
    });
    act(() => editor.dispatchEvent(composingEscape));
    expect(composingEscape.defaultPrevented).toBe(false);
    expect(onEscape).toHaveBeenCalledOnce();

    act(() => root?.render(<Fixture onEscape={onEscape} bridgeEnabled={false} />));
    const disabledEditor = container!.querySelector<HTMLElement>('[data-editor]')!;
    const disabledEscape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => disabledEditor.dispatchEvent(disabledEscape));
    expect(disabledEscape.defaultPrevented).toBe(false);
    expect(onEscape).toHaveBeenCalledOnce();
  });

  it('does not consume editor Tab when its first action rejects focus', () => {
    render(<Fixture />);
    const editor = container!.querySelector<HTMLElement>('[data-editor]')!;
    const actions = [...container!.querySelectorAll<HTMLButtonElement>('[data-selection-toolbar-action]')].filter(
      (action) => action.textContent === 'First' || action.textContent === 'Last',
    );
    actions[0]!.focus = vi.fn();
    act(() => editor.focus());
    const failedTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => editor.dispatchEvent(failedTab));
    expect(failedTab.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(editor);
  });

  it('does not consume Escape without a focus-restoration callback', () => {
    render(<Fixture />);
    const first = container!.querySelector<HTMLButtonElement>('[data-selection-toolbar-action]')!;
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => first.dispatchEvent(escape));
    expect(escape.defaultPrevented).toBe(false);
  });
});

const paragraph = (text: string) => ({
  type: 'paragraph',
  attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
  content: [{ type: 'text', text }],
});

const editorContent: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'blockGroup',
      content: [
        {
          type: 'blockContainer',
          attrs: { id: 'selection-toolbar-dismiss-test' },
          content: [paragraph('selection bookmark')],
        },
      ],
    },
  ],
};

const rejectToolbarFocus = () => false;
const dismissalBridgeMenuKey = new PluginKey('selection-toolbar-dismissal-bridge-test');

function DismissalBridge({ editor }: { editor: Editor }) {
  const menu = useTiptapBubbleMenu(editor, dismissalBridgeMenuKey);
  useSelectionToolbarEditorTabBridge(editor.view.dom, rejectToolbarFocus, true, menu.hide);
  return null;
}

function NativeEditingBridge({ editor }: { editor: Editor }) {
  const menu = useTiptapBubbleMenu(editor, 'native-editing-boundary-test');
  return <output data-suppressed={menu.isSuppressed} data-dismissed={menu.isDismissed} />;
}

describe('Tiptap BubbleMenu keyboard bridge', () => {
  it('suppresses block bubbles during nested input/source editing without losing editor selection', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = new Editor({ element, extensions: createTiptapWireExtensions(), content: editorContent });
    const controls = document.createElement('div');
    controls.contentEditable = 'false';
    const input = document.createElement('input');
    const source = document.createElement('div');
    source.dataset.sourceEditor = 'monaco';
    const sourceTarget = document.createElement('button');
    source.append(sourceTarget);
    controls.append(input, source);
    editor.view.dom.append(controls);
    render(<NativeEditingBridge editor={editor} />);
    const before = editor.state.selection.toJSON();
    act(() => input.focus());
    expect(container!.querySelector('output')?.dataset.suppressed).toBe('true');
    expect(container!.querySelector('output')?.dataset.dismissed).toBe('false');
    act(() => sourceTarget.focus());
    expect(container!.querySelector('output')?.dataset.suppressed).toBe('true');
    act(() => editor.view.dom.focus());
    expect(container!.querySelector('output')?.dataset.suppressed).toBe('false');
    expect(editor.state.selection.toJSON()).toEqual(before);
    act(() => root?.unmount());
    root = null;
    editor.destroy();
    element.remove();
  });

  it('dismisses from editor-root Escape with the exact selection and one meta-only transaction', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = new Editor({ element, extensions: createTiptapWireExtensions(), content: editorContent });
    let paragraphPosition = -1;
    editor.state.doc.descendants((node, position) => {
      if (paragraphPosition < 0 && node.type.name === 'paragraph') {
        paragraphPosition = position;
      }
    });
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, paragraphPosition + 1, paragraphPosition + 6),
      ),
    );
    const beforeDocument = editor.state.doc.toJSON();
    const beforeSelection = editor.state.selection.toJSON();
    editor.view.focus();
    const transactions: Array<{ docChanged: boolean; menuMeta: unknown; focused: boolean }> = [];
    editor.on('transaction', ({ transaction }) => {
      transactions.push({
        docChanged: transaction.docChanged,
        menuMeta: transaction.getMeta(dismissalBridgeMenuKey),
        focused: document.activeElement === editor.view.dom,
      });
    });

    render(<DismissalBridge editor={editor} />);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => editor.view.dom.dispatchEvent(escape));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(escape.defaultPrevented).toBe(true);
    expect(transactions).toEqual([{ docChanged: false, menuMeta: 'hide', focused: true }]);
    expect(editor.state.doc.toJSON()).toEqual(beforeDocument);
    expect(editor.state.selection.toJSON()).toEqual(beforeSelection);

    editor.destroy();
    element.remove();
  });
});
