// @vitest-environment jsdom

import { I18nProvider } from 'react-aria-components';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';

import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import enMessages from '@/messages/en.json';
import { createTiptapWireExtensions } from './wire-schema';
import { createTiptapBlockContainer } from './TiptapBlockContainerNodeView';
import { createAuthoringShortcutGuard } from './integration/authoring-shortcuts';

Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

function paragraph(id: string, text: string) {
  return {
    type: 'blockContainer',
    attrs: { id },
    content: [
      {
        type: 'paragraph',
        attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
        content: [{ type: 'text', text }],
      },
    ],
  };
}

function callout(id: string, icon = '💡') {
  return {
    type: 'blockContainer',
    attrs: { id },
    content: [
      {
        type: 'callout',
        attrs: { icon, backgroundColor: 'gray', textColor: 'default' },
        content: [{ type: 'text', text: 'Callout copy' }],
      },
    ],
  };
}

const editableAuthoringMode: EditorAuthoringMode = {
  allowNeutralBlockEdits: true,
  allowLocalizedBlockEdits: true,
};

function TestEditor({
  content,
  mode,
  editable,
  onReady,
}: {
  content: Record<string, unknown>;
  mode: EditorAuthoringMode;
  editable: boolean;
  onReady: (editor: Editor) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      ...createTiptapWireExtensions({ blockContainerNode: createTiptapBlockContainer(mode) }),
      createAuthoringShortcutGuard(mode),
    ],
    content,
  });
  useEffect(() => {
    if (editor) {
      onReady(editor);
    }
  }, [editor, onReady]);
  return <EditorContent editor={editor} />;
}

async function mountEditor({
  blocks = [paragraph('first', 'First'), paragraph('second', 'Second')],
  mode = editableAuthoringMode,
  editable = true,
}: {
  blocks?: Array<Record<string, unknown>>;
  mode?: EditorAuthoringMode;
  editable?: boolean;
} = {}) {
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  let editor: Editor | null = null;
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <I18nProvider locale="en">
          <TestEditor
            content={{ type: 'doc', content: [{ type: 'blockGroup', content: blocks }] }}
            mode={mode}
            editable={editable}
            onReady={(value) => (editor = value)}
          />
        </I18nProvider>
      </NextIntlClientProvider>,
    );
  });
  if (!editor) {
    throw new Error('Tiptap editor did not mount');
  }
  return {
    editor: editor as Editor,
    element,
    async destroy() {
      await act(async () => root.unmount());
      element.remove();
    },
  };
}

function getMenuItem(label: string): HTMLButtonElement {
  const items = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  const item = items.find((candidate) => candidate.textContent?.trim() === label);
  if (!item) {
    throw new Error(
      `Menu item not found: ${label}. Available: ${items.map((candidate) => candidate.textContent?.trim()).join(', ')}`,
    );
  }
  return item;
}

async function clickBlockHandle(handle: HTMLButtonElement | null | undefined) {
  if (!handle) {
    return null;
  }
  const blockId = handle.closest<HTMLElement>('[data-id]')?.dataset.id;
  await act(async () => {
    handle.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true }));
  });
  const currentHandle = blockId
    ? Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid="tiptap-block-drag-handle"]')).find(
        (candidate) => candidate.closest<HTMLElement>('[data-id]')?.dataset.id === blockId,
      )
    : handle;
  await act(async () => {
    currentHandle?.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true, cancelable: true }));
    currentHandle?.click();
  });
  return currentHandle ?? null;
}

async function pressBlockHandle(handle: HTMLButtonElement | null | undefined, key: string) {
  await act(async () => {
    handle?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    if (key === 'Enter' || key === ' ') {
      handle?.click();
    }
    handle?.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
  });
}

describe('Tiptap block handle menu', () => {
  it('opens the existing current-block menu from Shift+F10 and restores its trigger without changing the document', async () => {
    const mounted = await mountEditor();
    try {
      await act(async () => {
        mounted.editor.commands.setTextSelection(3);
        mounted.editor.view.focus();
      });
      const source = mounted.editor.state.doc.toJSON();
      const selection = mounted.editor.state.selection.toJSON();
      const event = new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true });
      await act(async () => mounted.editor.view.dom.dispatchEvent(event));
      expect(event.defaultPrevented).toBe(true);
      expect(mounted.element.querySelector('[data-testid="tiptap-block-menu"]')).not.toBeNull();
      expect(mounted.element.querySelector('[data-id="first"] [data-testid="tiptap-block-menu"]')).not.toBeNull();
      await vi.waitFor(() => expect(document.activeElement?.closest('[role="menu"]')).not.toBeNull());
      await act(async () =>
        document.activeElement?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
        ),
      );
      await vi.waitFor(() => expect(mounted.element.querySelector('[data-testid="tiptap-block-menu"]')).toBeNull());
      await vi.waitFor(() =>
        expect(
          mounted.element.querySelector('[data-id="first"] [data-testid="tiptap-block-drag-handle"]'),
        ).toHaveFocus(),
      );
      expect(mounted.editor.state.doc.toJSON()).toEqual(source);
      expect(mounted.editor.state.selection.toJSON()).toEqual(selection);
    } finally {
      await mounted.destroy();
    }
  });

  it('waits for a completed click so pointerdown can start a native drag', async () => {
    const mounted = await mountEditor();
    const handle = mounted.element.querySelector<HTMLButtonElement>('[data-testid="tiptap-block-drag-handle"]');
    await act(async () => {
      handle?.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true }));
    });
    expect(handle?.getAttribute('aria-expanded')).not.toBe('true');
    await act(async () => {
      handle?.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true, cancelable: true }));
      handle?.click();
    });
    expect(handle?.getAttribute('aria-expanded')).toBe('true');
    await mounted.destroy();
  });
  it('hides drag handles during text selection and restores them when the caret collapses', async () => {
    const mounted = await mountEditor();
    expect(mounted.element.querySelector('[data-testid="tiptap-block-drag-handle"]')).not.toBeNull();
    await act(async () => mounted.editor.commands.setTextSelection({ from: 3, to: 5 }));
    expect(mounted.element.querySelector('[data-testid="tiptap-block-drag-handle"]')).toBeNull();
    await act(async () => mounted.editor.commands.setTextSelection(3));
    expect(mounted.element.querySelector('[data-testid="tiptap-block-drag-handle"]')).not.toBeNull();
    await mounted.destroy();
  });

  it('opens a truthful contextual menu and deletes the selected block', async () => {
    const mounted = await mountEditor();
    const handle = mounted.element.querySelector<HTMLButtonElement>('[data-testid="tiptap-block-drag-handle"]');
    expect(handle?.getAttribute('aria-label')).toBe('Open block menu');
    expect(handle?.draggable).toBe(true);
    expect(handle?.hasAttribute('data-drag-handle')).toBe(true);
    expect(handle?.tabIndex).toBe(-1);

    await clickBlockHandle(handle);
    expect(handle?.getAttribute('aria-expanded')).toBe('true');
    await act(async () => getMenuItem('Delete').click());

    const blockGroup = mounted.editor.state.doc.firstChild;
    expect(blockGroup?.childCount).toBe(1);
    expect(blockGroup?.firstChild?.attrs.id).toBe('second');
    await mounted.destroy();
  });

  it('exposes the prior block color action and writes the color to block content', async () => {
    const mounted = await mountEditor();
    const handle = mounted.element.querySelector<HTMLButtonElement>('[data-testid="tiptap-block-drag-handle"]');
    await clickBlockHandle(handle);
    const colors = getMenuItem('Colors');
    await act(async () => colors.focus());
    await act(async () => {
      colors.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    const redTextItem = document
      .querySelector<HTMLElement>('[data-editor-color-swatch="text"][data-color="red"]')
      ?.closest<HTMLElement>('[role="menuitem"]');
    expect(document.querySelectorAll('[data-editor-color-swatch="text"]')).toHaveLength(10);
    expect(document.querySelectorAll('[data-editor-color-swatch="background"]')).toHaveLength(10);
    expect(redTextItem?.textContent).toContain('Red');
    await act(async () => redTextItem?.click());

    expect(mounted.editor.state.doc.firstChild?.firstChild?.firstChild?.attrs.textColor).toBe('red');
    await mounted.destroy();
  });

  it('keeps empty nested Callouts editable with their own Core block menu', async () => {
    const outer = callout('outer');
    const nested = {
      type: 'blockContainer',
      attrs: { id: 'nested' },
      content: [{ type: 'callout', attrs: { icon: '🔥' } }],
    };
    const mounted = await mountEditor({
      blocks: [{ ...outer, content: [...outer.content, { type: 'blockGroup', content: [nested] }] }],
    });
    try {
      const nestedElement = mounted.element.querySelector<HTMLElement>('[data-id="nested"]')!;
      expect(nestedElement.querySelector('[data-content-type="callout"]')?.getAttribute('data-icon')).toBe('🔥');
      const handle = nestedElement.querySelector<HTMLButtonElement>('[data-testid="tiptap-block-drag-handle"]')!;
      expect(handle.getAttribute('data-control-size')).toBe('compact');
      await clickBlockHandle(handle);
      expect(document.querySelector('[role="menu"]')).not.toBeNull();
      let position = -1;
      mounted.editor.state.doc.descendants((node, offset) => {
        if (node.type.name === 'blockContainer' && node.attrs.id === 'nested') {
          position = offset + 2;
        }
      });
      expect(position).toBeGreaterThan(0);
      await act(async () => {
        mounted.editor.commands.insertContentAt(position, 'Nested input');
      });
      const nestedBlock = mounted.editor.state.doc.firstChild?.firstChild?.lastChild?.firstChild;
      expect(nestedBlock?.firstChild?.textContent).toBe('Nested input');
      expect(mounted.element.querySelectorAll('[data-content-type="callout"]')).toHaveLength(2);
    } finally {
      await mounted.destroy();
    }
  });

  it('searches the shared Emoji catalog and changes a Callout icon directly', async () => {
    class TestPointerEvent extends MouseEvent {
      pointerType = 'mouse';
      pointerId = 1;
      width = 1;
      height = 1;
      isPrimary = true;
    }
    vi.stubGlobal('PointerEvent', TestPointerEvent);
    // RAC intentionally treats unmeasured jsdom viewports as infinite. Give the real
    // virtualizer a finite viewport rather than rendering the full emoji catalogue.
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(340);
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(252);
    const applyNeutralBlockProps = vi.fn();
    const mounted = await mountEditor({
      blocks: [callout('notice')],
      mode: { ...editableAuthoringMode, applyNeutralBlockProps },
    });
    const picker = mounted.element.querySelector<HTMLButtonElement>('[data-testid="tiptap-callout-icon-picker"]');
    expect(picker?.getAttribute('aria-label')).toBe('Emoji');

    await act(async () => {
      picker?.click();
    });
    const search = document.body.querySelector<HTMLInputElement>('[aria-label="Search for and insert an emoji"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(search, 'fire');
      search?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const fire = document.body.querySelector<HTMLButtonElement>('[role="option"][aria-label=":fire:"]');
    expect(fire?.textContent).toBe('🔥');
    await act(async () => {
      fire?.dispatchEvent(new TestPointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
      fire?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
      fire?.focus();
      fire?.dispatchEvent(new TestPointerEvent('pointerup', { bubbles: true, cancelable: true, button: 0 }));
      fire?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
      fire?.click();
    });

    expect(mounted.editor.state.doc.firstChild?.firstChild?.firstChild?.attrs.icon).toBe('🔥');
    expect(applyNeutralBlockProps).toHaveBeenCalledWith('notice', { icon: '🔥' });
    await mounted.destroy();
    width.mockRestore();
    height.mockRestore();
    vi.unstubAllGlobals();
  });

  it('opens from the keyboard without removing the drag path', async () => {
    const mounted = await mountEditor();
    const handle = mounted.element.querySelector<HTMLButtonElement>('[data-testid="tiptap-block-drag-handle"]');
    handle?.focus();
    await pressBlockHandle(handle, 'Enter');
    expect(handle?.getAttribute('aria-expanded')).toBe('true');
    expect(handle?.hasAttribute('data-drag-handle')).toBe(true);
    await mounted.destroy();
  });

  it('previews the actual drop boundary and moves the whole block without opening the menu', async () => {
    const mounted = await mountEditor();
    const handle = mounted.element.querySelector<HTMLButtonElement>('[data-testid="tiptap-block-drag-handle"]');
    const payload = new Map<string, string>();
    const dataTransfer = {
      files: [],
      clearData: () => payload.clear(),
      setData: (type: string, value: string) => payload.set(type, value),
      getData: (type: string) => payload.get(type) ?? '',
      setDragImage: vi.fn(),
      effectAllowed: '',
    };
    const dragEvent = (type: string) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
      return event;
    };
    // jsdom has no hit testing; retain ProseMirror's real drag/drop handlers.
    const coordinates = vi.spyOn(mounted.editor.view, 'posAtCoords').mockReturnValue({ pos: 1, inside: 1 });
    await act(async () => {
      handle?.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
      handle?.dispatchEvent(dragEvent('dragstart'));
    });
    expect(mounted.editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(mounted.editor.view.dragging?.slice.content.firstChild?.attrs.id).toBe('first');
    expect(payload.get('text/html')).toContain('data-id="first"');
    expect(handle?.getAttribute('aria-expanded')).not.toBe('true');
    expect(handle?.closest('[data-geul-reorder-gutter]')?.getAttribute('data-geul-reorder-gutter')).toBe('active');
    const dropPosition = mounted.editor.state.doc.firstChild!.nodeSize - 1;
    coordinates.mockReturnValue({ pos: dropPosition, inside: 0 });
    // The native Dropcursor measures the editor's real DOM. Supply geometry
    // here because jsdom does not perform layout.
    Object.defineProperties(mounted.editor.view.dom, {
      offsetParent: { value: mounted.element, configurable: true },
      offsetWidth: { value: 600, configurable: true },
      offsetHeight: { value: 100, configurable: true },
    });
    Object.defineProperties(mounted.element, {
      offsetWidth: { value: 600, configurable: true },
      offsetHeight: { value: 100, configurable: true },
    });
    vi.spyOn(mounted.editor.view.dom, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 100));
    vi.spyOn(mounted.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 100));
    const secondDOM = mounted.editor.view.nodeDOM(
      1 + mounted.editor.state.doc.firstChild!.firstChild!.nodeSize,
    ) as HTMLElement;
    vi.spyOn(secondDOM, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 80, 600, 20));
    await act(async () => mounted.editor.view.dom.dispatchEvent(dragEvent('dragover')));
    const guide = mounted.element.querySelector<HTMLElement>('.prosemirror-dropcursor-block');
    expect(guide?.style.backgroundColor).toBe('var(--geul-focus)');
    expect(guide?.style.width).toBe('600px');
    expect(guide?.style.height).toBe('2px');
    expect(guide?.style.top).toBe('99px');
    expect(guide?.style.pointerEvents).toBe('none');
    await act(async () => mounted.editor.view.dom.dispatchEvent(dragEvent('drop')));
    coordinates.mockRestore();
    const ids: string[] = [];
    mounted.editor.state.doc.firstChild?.forEach((block) => ids.push(block.attrs.id));
    expect(ids).toEqual(['second', 'first']);
    expect(mounted.editor.view.dragging).toBeNull();
    await act(async () => handle?.dispatchEvent(dragEvent('dragend')));
    expect(
      mounted.element
        .querySelector('[data-id="first"] [data-geul-reorder-gutter]')
        ?.getAttribute('data-geul-reorder-gutter'),
    ).toBe('on-interaction');
    document.dispatchEvent(new Event('dragend'));
    await vi.waitFor(() => expect(mounted.element.querySelector('.prosemirror-dropcursor-block')).toBeNull());
    await mounted.destroy();
  });

  it('removes selected chrome and drag handles when an authoring NodeSelection becomes read-only', async () => {
    const mounted = await mountEditor();
    await act(async () => {
      mounted.editor.view.dispatch(
        mounted.editor.state.tr.setSelection(NodeSelection.create(mounted.editor.state.doc, 1)),
      );
    });

    let block = mounted.element.querySelector<HTMLElement>('[data-id="first"]');
    expect(block?.getAttribute('data-selected')).toBe('true');
    expect(block?.querySelector<HTMLButtonElement>('[data-testid="tiptap-block-drag-handle"]')?.tabIndex).toBe(-1);
    await act(async () => {
      mounted.editor.setEditable(false);
    });
    block = mounted.element.querySelector<HTMLElement>('[data-id="first"]');
    expect(block?.hasAttribute('data-selected')).toBe(false);
    expect(block?.querySelector('[data-testid="tiptap-block-drag-handle"]')).toBeNull();
    expect(block?.hasAttribute('tabindex')).toBe(false);
    await mounted.destroy();
  });

  it.each([' ', 'ArrowDown'])('opens the same menu with the %s key', async (key) => {
    const mounted = await mountEditor();
    const handle = mounted.element.querySelector<HTMLButtonElement>('[data-testid="tiptap-block-drag-handle"]');
    handle?.focus();
    await pressBlockHandle(handle, key);
    expect(handle?.getAttribute('aria-expanded')).toBe('true');
    await mounted.destroy();
  });

  it('does not expose structure or neutral-prop controls in localized-only authoring', async () => {
    const deleteNeutralBlock = vi.fn();
    const applyNeutralBlockProps = vi.fn();
    const mounted = await mountEditor({
      mode: {
        allowNeutralBlockEdits: false,
        allowLocalizedBlockEdits: true,
        deleteNeutralBlock,
        applyNeutralBlockProps,
      },
    });
    expect(mounted.element.querySelector('[data-testid="tiptap-block-drag-handle"]')).toBeNull();
    mounted.element
      .querySelector<HTMLElement>('[data-node-type="blockContainer"]')
      ?.dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true }));
    expect(deleteNeutralBlock).not.toHaveBeenCalled();
    expect(applyNeutralBlockProps).not.toHaveBeenCalled();
    expect(mounted.editor.state.doc.firstChild?.childCount).toBe(2);
    await mounted.destroy();
  });

  it('routes delete and color mutations to the registered neutral authority', async () => {
    const deleteNeutralBlock = vi.fn();
    const applyNeutralBlockProps = vi.fn();
    const mode: EditorAuthoringMode = {
      allowNeutralBlockEdits: true,
      allowLocalizedBlockEdits: true,
      deleteNeutralBlock,
      applyNeutralBlockProps,
    };
    const mounted = await mountEditor({ mode });
    const handle = mounted.element.querySelector<HTMLButtonElement>('[data-testid="tiptap-block-drag-handle"]');
    await clickBlockHandle(handle);
    const colors = getMenuItem('Colors');
    await act(async () => colors.focus());
    await act(async () => {
      colors.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    const blueTextItem = document
      .querySelector<HTMLElement>('[data-editor-color-swatch="text"][data-color="blue"]')
      ?.closest<HTMLElement>('[role="menuitem"]');
    expect(blueTextItem?.textContent).toContain('Blue');
    await act(async () => blueTextItem?.click());
    expect(applyNeutralBlockProps).toHaveBeenCalledWith('first', { textColor: 'blue' });

    await clickBlockHandle(handle);
    await act(async () => getMenuItem('Delete').click());
    expect(deleteNeutralBlock).toHaveBeenCalledWith('first');
    await mounted.destroy();
  });

  it('rejects deleting the last root block because no shared replacement-ID authority exists', async () => {
    const deleteNeutralBlock = vi.fn();
    const mounted = await mountEditor({
      blocks: [paragraph('only', 'Only')],
      mode: { ...editableAuthoringMode, deleteNeutralBlock },
    });
    const handle = mounted.element.querySelector<HTMLButtonElement>('[data-testid="tiptap-block-drag-handle"]');
    await clickBlockHandle(handle);
    const deleteItem = getMenuItem('Delete');
    expect(deleteItem.getAttribute('aria-disabled')).toBe('true');
    await act(async () => deleteItem.click());
    expect(mounted.editor.state.doc.firstChild?.childCount).toBe(1);
    expect(mounted.editor.state.doc.firstChild?.firstChild?.attrs.id).toBe('only');
    expect(deleteNeutralBlock).not.toHaveBeenCalled();
    await mounted.destroy();
  });

  it('removes the empty child group when deleting its sole nested block', async () => {
    const deleteNeutralBlock = vi.fn();
    const parent = {
      type: 'blockContainer',
      attrs: { id: 'parent' },
      content: [
        {
          type: 'paragraph',
          attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
          content: [{ type: 'text', text: 'Parent' }],
        },
        { type: 'blockGroup', content: [paragraph('child', 'Child')] },
      ],
    };
    const mounted = await mountEditor({
      blocks: [parent],
      mode: { ...editableAuthoringMode, deleteNeutralBlock },
    });
    const handles = mounted.element.querySelectorAll<HTMLButtonElement>('[data-testid="tiptap-block-drag-handle"]');
    await clickBlockHandle(handles[1]);
    await act(async () => getMenuItem('Delete').click());
    expect(mounted.editor.state.doc.firstChild?.firstChild?.childCount).toBe(1);
    expect(deleteNeutralBlock).toHaveBeenCalledWith('child');
    await mounted.destroy();
  });
});
