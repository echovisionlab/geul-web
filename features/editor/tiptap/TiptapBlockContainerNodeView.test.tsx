// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import { MantineProvider } from '@mantine/core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import enMessages from '@/messages/en.json';
import { createTiptapWireExtensions } from './wire-schema';
import { createTiptapBlockContainer } from './TiptapBlockContainerNodeView';

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
    extensions: createTiptapWireExtensions({ blockContainerNode: createTiptapBlockContainer(mode) }),
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
        <MantineProvider env="test">
          <TestEditor
            content={{ type: 'doc', content: [{ type: 'blockGroup', content: blocks }] }}
            mode={mode}
            editable={editable}
            onReady={(value) => (editor = value)}
          />
        </MantineProvider>
      </NextIntlClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
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
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const currentHandle = blockId
    ? Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid="tiptap-block-drag-handle"]')).find(
        (candidate) => candidate.closest<HTMLElement>('[data-id]')?.dataset.id === blockId,
      )
    : handle;
  await act(async () => {
    currentHandle?.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true, cancelable: true }));
    currentHandle?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
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
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('Tiptap block handle menu', () => {
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
    colors.focus();
    await act(async () => {
      colors.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const redTextItem = document
      .querySelector<HTMLElement>('[data-editor-color-swatch="text"][data-color="red"]')
      ?.closest<HTMLButtonElement>('button');
    expect(document.querySelectorAll('[data-editor-color-swatch="text"]')).toHaveLength(10);
    expect(document.querySelectorAll('[data-editor-color-swatch="background"]')).toHaveLength(10);
    expect(redTextItem?.textContent).toContain('Red');
    await act(async () => redTextItem?.click());

    expect(mounted.editor.state.doc.firstChild?.firstChild?.firstChild?.attrs.textColor).toBe('red');
    await mounted.destroy();
  });

  it('searches the shared Emoji catalog and changes a Callout icon directly', async () => {
    const applyNeutralBlockProps = vi.fn();
    const mounted = await mountEditor({
      blocks: [callout('notice')],
      mode: { ...editableAuthoringMode, applyNeutralBlockProps },
    });
    const picker = mounted.element.querySelector<HTMLButtonElement>('[data-testid="tiptap-callout-icon-picker"]');
    expect(picker?.getAttribute('aria-label')).toBe('Emoji');

    await act(async () => {
      picker?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const search = document.body.querySelector<HTMLInputElement>('[aria-label="Search for and insert an emoji"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(search, 'fire');
      search?.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const fire = document.body.querySelector<HTMLButtonElement>('[role="option"][aria-label=":fire:"]');
    expect(fire?.textContent).toBe('🔥');
    await act(async () => fire?.click());

    expect(mounted.editor.state.doc.firstChild?.firstChild?.firstChild?.attrs.icon).toBe('🔥');
    expect(applyNeutralBlockProps).toHaveBeenCalledWith('notice', { icon: '🔥' });
    await mounted.destroy();
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

  it('marks the block selection on native Tiptap drag start without opening the menu', async () => {
    const mounted = await mountEditor();
    const handle = mounted.element.querySelector<HTMLButtonElement>('[data-testid="tiptap-block-drag-handle"]');
    await act(async () => {
      handle?.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
      handle?.dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true }));
    });
    expect(mounted.editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(handle?.getAttribute('aria-expanded')).not.toBe('true');
    document.dispatchEvent(new Event('dragend'));
    await mounted.destroy();
  });

  it('removes selected chrome and drag handles when an authoring NodeSelection becomes read-only', async () => {
    const mounted = await mountEditor();
    await act(async () => {
      mounted.editor.view.dispatch(
        mounted.editor.state.tr.setSelection(NodeSelection.create(mounted.editor.state.doc, 1)),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    let block = mounted.element.querySelector<HTMLElement>('[data-id="first"]');
    expect(block?.getAttribute('data-selected')).toBe('true');
    expect(block?.querySelector<HTMLButtonElement>('[data-testid="tiptap-block-drag-handle"]')?.tabIndex).toBe(-1);
    await act(async () => {
      mounted.editor.setEditable(false);
      await new Promise((resolve) => setTimeout(resolve, 0));
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
    colors.focus();
    await act(async () => {
      colors.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const blueTextItem = document
      .querySelector<HTMLElement>('[data-editor-color-swatch="text"][data-color="blue"]')
      ?.closest<HTMLButtonElement>('button');
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
    expect(deleteItem.disabled).toBe(true);
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
