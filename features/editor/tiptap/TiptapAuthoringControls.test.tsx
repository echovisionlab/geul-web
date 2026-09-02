// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import koMessages from '@/messages/ko.json';
import { createTiptapWireExtensions } from './wire-schema';
import {
  applyTiptapSlashItem,
  createTiptapSlashItems,
  getSlashMenuState,
  TiptapAuthoringControls,
  type TiptapSlashActionContext,
} from './TiptapAuthoringControls';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const enEditorMessages = enMessages.editorCommon.editor;
const koEditorMessages = koMessages.editorCommon.editor;

vi.mock('next-intl', () => ({
  useLocale: () => 'ko',
  useTranslations: () =>
    Object.assign((key: string) => key, {
      raw: (key: string) => (key === 'slashMenu' ? koMessages.editorCommon.editor.slashMenu : key),
    }),
}));

Object.defineProperties(Range.prototype, {
  getBoundingClientRect: {
    configurable: true,
    value: () => document.body.getBoundingClientRect(),
  },
  getClientRects: {
    configurable: true,
    value: () => [document.body.getBoundingClientRect()],
  },
});

function createEditor(text = '/heading') {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: createTiptapWireExtensions(),
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'target-block' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
            },
          ],
        },
      ],
    },
  });
  return {
    editor,
    destroy() {
      editor.destroy();
      element.remove();
    },
  };
}

function createEditorWithBlock(content: Record<string, unknown>) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: createTiptapWireExtensions(),
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [{ type: 'blockContainer', attrs: { id: 'target-block' }, content: [content] }],
        },
      ],
    },
  });
  return {
    editor,
    destroy() {
      editor.destroy();
      element.remove();
    },
  };
}

async function renderControls(
  editor: Editor,
  onFileActivate?: (blockId: string, context?: TiptapSlashActionContext) => void,
  onMapActivate?: (context: TiptapSlashActionContext) => void,
) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MantineProvider>
        <TiptapAuthoringControls
          editor={editor}
          capabilities={{ file: Boolean(onFileActivate), map: Boolean(onMapActivate) }}
          onFileActivate={onFileActivate}
          onMapActivate={onMapActivate}
        />
      </MantineProvider>,
    );
  });
  return {
    async destroy() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

async function flushMenuUpdate() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('Tiptap authoring controls', () => {
  it('uses the editor-neutral slash labels and exposes the unified file item', () => {
    const items = createTiptapSlashItems(koEditorMessages);

    expect(items.find((item) => item.key === 'heading')).toMatchObject({
      execution: { type: 'intrinsic', nodeName: 'heading' },
      enabled: true,
    });
    expect(items.find((item) => item.key === 'file')).toMatchObject({
      execution: { type: 'workflow', workflow: 'file' },
      enabled: false,
    });
    expect(items.find((item) => item.key === 'map')).toMatchObject({
      enabled: false,
      unavailableReason: expect.any(String),
    });
    expect(items.find((item) => item.key === 'external-video')).toMatchObject({
      enabled: false,
      unavailableReason: expect.any(String),
    });
    expect(items.find((item) => item.key === 'ai')).toMatchObject({
      enabled: false,
      unavailableReason: expect.any(String),
    });
  });

  it('keeps promised but unbound capabilities visible as explicit unavailable items', () => {
    const unavailableItems = createTiptapSlashItems(enEditorMessages, {
      ai: true,
      externalVideo: true,
      map: true,
      table: true,
    });
    for (const key of ['ai', 'external-video', 'map']) {
      expect(unavailableItems.find((item) => item.key === key)).toMatchObject({
        enabled: false,
        unavailableReason: expect.any(String),
      });
    }
    expect(unavailableItems.find((item) => item.key === 'table')).toMatchObject({ enabled: true });

    const boundItems = createTiptapSlashItems(
      enEditorMessages,
      { ai: true, externalVideo: true, map: true, table: true },
      {
        onAIAssistantActivate: vi.fn(),
        onExternalVideoActivate: vi.fn(),
        onMapActivate: vi.fn(),
        onTableActivate: vi.fn(),
      },
    );
    for (const key of ['ai', 'external-video', 'map', 'table']) {
      expect(boundItems.find((item) => item.key === key)).toMatchObject({
        enabled: true,
        unavailableReason: undefined,
      });
    }
  });

  it('replaces the slash query and changes only the current durable block content node', () => {
    const mounted = createEditor();
    const heading = createTiptapSlashItems(enEditorMessages).find((item) => item.key === 'heading');
    expect(heading).toBeDefined();
    mounted.editor.commands.setTextSelection(11);

    expect(
      applyTiptapSlashItem(mounted.editor, heading!, {
        from: 3,
        to: 11,
        contentPosition: 2,
        blockId: 'target-block',
      }),
    ).toBe(true);

    expect(mounted.editor.getJSON()).toMatchObject({
      content: [
        {
          content: [
            {
              attrs: { id: 'target-block' },
              content: [{ type: 'heading', attrs: { level: 1 } }],
            },
          ],
        },
      ],
    });
    expect(mounted.editor.getText()).not.toContain('/heading');
    mounted.destroy();
  });

  it('detects the exact slash range after inline math source and after a hard break', () => {
    for (const prefix of [
      [
        { type: 'mathInline', content: [{ type: 'text', text: 'x' }] },
        { type: 'text', text: ' /p5' },
      ],
      [{ type: 'text', text: 'Hello' }, { type: 'hardBreak' }, { type: 'text', text: '/p5' }],
    ]) {
      const mounted = createEditorWithBlock({ type: 'paragraph', content: prefix });
      const paragraph = mounted.editor.state.doc.nodeAt(2);
      if (!paragraph) {
        throw new Error('Slash detection paragraph is missing');
      }
      const cursor = 3 + paragraph.content.size;
      mounted.editor.commands.setTextSelection(cursor);

      expect(getSlashMenuState(mounted.editor)).toMatchObject({
        from: cursor - '/p5'.length,
        to: cursor,
        contentPosition: 2,
        blockId: 'target-block',
        query: 'p5',
      });
      mounted.destroy();
    }
  });

  it('does not treat a slash inside ordinary text as a command boundary', () => {
    const mounted = createEditor('x/heading');
    const paragraph = mounted.editor.state.doc.nodeAt(2);
    if (!paragraph) {
      throw new Error('Ordinary-text paragraph is missing');
    }
    mounted.editor.commands.setTextSelection(3 + paragraph.content.size);

    expect(getSlashMenuState(mounted.editor)).toBeNull();
    mounted.destroy();
  });

  it('executes a block slash item after a hard break without deleting the prefix block', () => {
    const mounted = createEditorWithBlock({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hello' }, { type: 'hardBreak' }, { type: 'text', text: '/heading' }],
    });
    const paragraph = mounted.editor.state.doc.nodeAt(2);
    if (!paragraph) {
      throw new Error('Hard-break slash paragraph is missing');
    }
    const cursor = 3 + paragraph.content.size;
    mounted.editor.commands.setTextSelection(cursor);
    const range = getSlashMenuState(mounted.editor);
    const heading = createTiptapSlashItems(enEditorMessages).find((item) => item.key === 'heading');
    if (!range || !heading) {
      throw new Error('Hard-break slash item is missing');
    }

    expect(applyTiptapSlashItem(mounted.editor, heading, range)).toBe(true);
    const blocks = mounted.editor.getJSON().content?.[0]?.content ?? [];
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      attrs: { id: 'target-block' },
      content: [{ content: [{ text: 'Hello' }, { type: 'hardBreak' }] }],
    });
    expect(blocks[1]).toMatchObject({ content: [{ type: 'heading' }] });
    mounted.destroy();
  });

  it('executes a block slash item directly after inline math source', () => {
    const mounted = createEditorWithBlock({
      type: 'paragraph',
      content: [
        { type: 'mathInline', content: [{ type: 'text', text: 'x' }] },
        { type: 'text', text: '/heading' },
      ],
    });
    const paragraph = mounted.editor.state.doc.nodeAt(2);
    if (!paragraph) {
      throw new Error('Inline-math slash paragraph is missing');
    }
    const cursor = 3 + paragraph.content.size;
    mounted.editor.commands.setTextSelection(cursor);
    const range = getSlashMenuState(mounted.editor);
    const heading = createTiptapSlashItems(enEditorMessages).find((item) => item.key === 'heading');
    if (!range || !heading) {
      throw new Error('Inline-math slash item is missing');
    }

    expect(applyTiptapSlashItem(mounted.editor, heading, range)).toBe(true);
    const blocks = mounted.editor.getJSON().content?.[0]?.content ?? [];
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      attrs: { id: 'target-block' },
      content: [
        {
          content: [{ type: 'mathInline', content: [{ type: 'text', text: 'x' }] }],
        },
      ],
    });
    expect(blocks[1]).toMatchObject({ content: [{ type: 'heading' }] });
    mounted.destroy();
  });

  it('preserves leading whitespace as content and inserts the slash result after it', () => {
    const mounted = createEditor(' /heading');
    mounted.editor.commands.setTextSelection(12);
    const range = getSlashMenuState(mounted.editor);
    const heading = createTiptapSlashItems(enEditorMessages).find((item) => item.key === 'heading');
    if (!range || !heading) {
      throw new Error('Whitespace-prefix slash item is missing');
    }

    expect(applyTiptapSlashItem(mounted.editor, heading, range)).toBe(true);
    const blocks = mounted.editor.getJSON().content?.[0]?.content ?? [];
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ attrs: { id: 'target-block' }, content: [{ content: [{ text: ' ' }] }] });
    expect(blocks[1]).toMatchObject({ content: [{ type: 'heading' }] });
    mounted.destroy();
  });

  it('delegates the file workflow without mutating or deleting its exact slash anchor', () => {
    const mounted = createEditor();
    const onFileActivate = vi.fn();
    const file = createTiptapSlashItems(enEditorMessages, { file: true }, { onFileActivate }).find(
      (item) => item.key === 'file',
    );
    expect(file).toBeDefined();
    const before = mounted.editor.getJSON();

    expect(
      applyTiptapSlashItem(mounted.editor, file!, {
        from: 3,
        to: 11,
        contentPosition: 2,
        blockId: 'target-block',
      }),
    ).toBe(false);
    expect(onFileActivate).not.toHaveBeenCalled();
    expect(mounted.editor.getJSON()).toEqual(before);
    mounted.destroy();
  });

  it('activates the filtered file workflow from the exact /file Enter sequence', async () => {
    const mounted = createEditor('/file');
    mounted.editor.commands.setTextSelection(8);
    await act(async () => mounted.editor.view.focus());
    const onFileActivate = vi.fn<(blockId: string, context?: TiptapSlashActionContext) => void>();
    const controls = await renderControls(mounted.editor, onFileActivate);
    const before = mounted.editor.getJSON();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

    expect(document.querySelector('[data-testid="tiptap-slash-item-file"]')).toHaveAttribute('aria-selected', 'true');
    await act(async () => mounted.editor.view.dom.dispatchEvent(enter));

    expect(enter.defaultPrevented).toBe(true);
    expect(onFileActivate).toHaveBeenCalledWith(
      'target-block',
      expect.objectContaining({
        blockId: 'target-block',
        targetBlockId: 'target-block',
        placement: 'replace',
        triggerText: '/file',
      }),
    );
    expect(document.querySelector('[data-testid="tiptap-slash-menu"]')).toBeNull();
    expect(mounted.editor.getJSON()).toEqual(before);

    await controls.destroy();
    mounted.destroy();
  });

  it('dismisses a delegated map picker without consuming its slash anchor, then reopens after the query changes', async () => {
    const mounted = createEditor('/map');
    mounted.editor.commands.setTextSelection(7);
    await act(async () => mounted.editor.view.focus());
    const onMapActivate = vi.fn();
    const controls = await renderControls(mounted.editor, undefined, onMapActivate);
    const before = mounted.editor.getJSON();

    const mapOption = document.querySelector<HTMLButtonElement>('[data-testid="tiptap-slash-item-map"]');
    expect(mapOption).not.toBeNull();
    await act(async () => mapOption?.click());

    expect(onMapActivate).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: 'target-block',
        triggerText: '/map',
        range: expect.objectContaining({ from: 3, to: 7 }),
      }),
    );
    expect(document.querySelector('[data-testid="tiptap-slash-menu"]')).toBeNull();
    expect(mounted.editor.getJSON()).toEqual(before);
    expect(document.activeElement).toBe(mounted.editor.view.dom);

    // A picker cancel is a document no-op and restores the editor focus. The
    // original trigger stays intentionally dismissed until the user changes it.
    await act(async () => mounted.editor.view.focus());
    expect(document.querySelector('[data-testid="tiptap-slash-menu"]')).toBeNull();
    expect(mounted.editor.getJSON()).toEqual(before);

    await act(async () => mounted.editor.commands.insertContent('x'));
    await act(async () => mounted.editor.commands.deleteRange({ from: 7, to: 8 }));
    expect(document.querySelector('[data-testid="tiptap-slash-menu"]')).not.toBeNull();

    await controls.destroy();
    mounted.destroy();
  });

  it('scrolls the active slash option into view through keyboard navigation and wrap', async () => {
    const scrollIntoView = vi.fn(() => ({ instrumented: true }));
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    const mounted = createEditor('/');
    mounted.editor.commands.setTextSelection(4);
    await act(async () => mounted.editor.view.focus());
    const controls = await renderControls(mounted.editor, vi.fn());
    scrollIntoView.mockClear();

    const selectableOptions = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)'),
    );
    const fileIndex = selectableOptions.findIndex((option) => option.dataset.testid === 'tiptap-slash-item-file');
    if (fileIndex < 0) {
      throw new Error('Unified file option is missing');
    }
    for (let index = 0; index < fileIndex; index += 1) {
      await act(async () => {
        mounted.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      });
    }

    const menu = document.querySelector<HTMLElement>('[data-testid="tiptap-slash-menu"]');
    const fileOption = document.querySelector<HTMLElement>('[data-testid="tiptap-slash-item-file"]');
    expect(menu).not.toBeNull();
    expect(fileOption?.getAttribute('aria-selected')).toBe('true');
    expect(mounted.editor.view.dom.getAttribute('aria-controls')).toBe(menu?.id);
    expect(mounted.editor.view.dom.getAttribute('aria-activedescendant')).toBe(fileOption?.id);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest' });
    expect(document.activeElement).toBe(mounted.editor.view.dom);

    await act(async () => {
      mounted.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    const nextOption = selectableOptions[(fileIndex + 1) % selectableOptions.length];
    expect(nextOption?.getAttribute('aria-selected')).toBe('true');
    expect(mounted.editor.view.dom.getAttribute('aria-activedescendant')).toBe(nextOption?.id);

    await act(async () => {
      mounted.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(fileOption?.getAttribute('aria-selected')).toBe('true');
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest' });

    await act(async () => {
      mounted.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    });
    const headingOption = document.querySelector<HTMLElement>('[data-testid="tiptap-slash-item-heading"]');
    expect(headingOption?.getAttribute('aria-selected')).toBe('true');
    await act(async () => {
      mounted.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(selectableOptions.at(-1)?.getAttribute('aria-selected')).toBe('true');

    const beforeEscapeDocument = mounted.editor.getJSON();
    await act(async () => {
      mounted.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.querySelector('[data-testid="tiptap-slash-menu"]')).toBeNull();
    expect(mounted.editor.getJSON()).toEqual(beforeEscapeDocument);
    expect(document.activeElement).toBe(mounted.editor.view.dom);

    await act(async () => mounted.editor.commands.insertContent('h'));
    expect(document.querySelector('[data-testid="tiptap-slash-menu"]')).not.toBeNull();

    await controls.destroy();
    mounted.destroy();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
  });

  it('does not intercept IME composition keys while the slash menu is open', async () => {
    const mounted = createEditor('/');
    mounted.editor.commands.setTextSelection(4);
    await act(async () => mounted.editor.view.focus());
    const controls = await renderControls(mounted.editor, vi.fn());
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true });
    Object.defineProperty(event, 'isComposing', { configurable: true, value: true });

    await act(async () =>
      mounted.editor.view.dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })),
    );
    await act(async () => mounted.editor.view.dom.dispatchEvent(event));
    expect(document.querySelector('[data-testid="tiptap-slash-menu"]')).not.toBeNull();
    expect(mounted.editor.getText()).toContain('/');
    await act(async () =>
      mounted.editor.view.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })),
    );

    await controls.destroy();
    mounted.destroy();
  });

  it('shows the official bubble menu only for text selections and applies formatting without losing selection', async () => {
    const text = 'Selectable text';
    const mounted = createEditor(text);
    const controls = await renderControls(mounted.editor);
    await act(async () => mounted.editor.view.focus());
    await act(async () => {
      mounted.editor.commands.setTextSelection({ from: 3, to: 3 + text.length });
    });
    await flushMenuUpdate();

    expect(document.querySelector('[data-testid="tiptap-selection-menu"]')).toBeNull();

    await act(async () => {
      mounted.editor.commands.setTextSelection(3 + text.length);
    });
    await flushMenuUpdate();
    expect(document.querySelector('[data-testid="tiptap-selection-menu"]')).toBeNull();

    await controls.destroy();
    mounted.destroy();
  });

  it('routes unified MIME file replacement through the selected durable block ID and keeps the node selected', async () => {
    const onFileActivate = vi.fn();
    const mounted = createEditorWithBlock({ type: 'file', attrs: { mimeType: 'video/mp4', name: 'clip.mp4' } });
    const controls = await renderControls(mounted.editor, onFileActivate);
    await act(async () => {
      mounted.editor.view.focus();
      mounted.editor.commands.setNodeSelection(2);
    });
    await flushMenuUpdate();

    const menu = document.querySelector<HTMLElement>('[data-testid="tiptap-file-menu"]');
    expect(menu).not.toBeNull();
    const replace = document.querySelector<HTMLButtonElement>('[data-testid="tiptap-file-replace"]');
    await act(async () => replace?.click());
    expect(onFileActivate).toHaveBeenCalledWith('target-block');
    expect(mounted.editor.state.selection).toBeInstanceOf(NodeSelection);
    await controls.destroy();
    mounted.destroy();
  });

  it('gives the file bubble menu one keyboard tab stop and returns focus to the editor', async () => {
    const mounted = createEditorWithBlock({ type: 'file', attrs: { mimeType: 'application/pdf', name: 'notes.pdf' } });
    const controls = await renderControls(mounted.editor, vi.fn());
    await act(async () => {
      mounted.editor.view.focus();
      mounted.editor.commands.setNodeSelection(2);
    });
    await flushMenuUpdate();

    const toolbar = document.querySelector<HTMLElement>('[data-testid="tiptap-file-menu"]')!;
    const actions = [...toolbar.querySelectorAll<HTMLButtonElement>('[data-selection-toolbar-action]')];
    const first = actions[0]!;
    const last = actions[actions.length - 1]!;
    const fileSelection = mounted.editor.state.selection.toJSON();
    expect(toolbar).toHaveAttribute('role', 'toolbar');
    expect(toolbar).not.toHaveAttribute('tabindex');
    expect(actions).toHaveLength(5);
    expect(actions.filter((action) => action.tabIndex === 0)).toHaveLength(1);

    const pointer = new Event('pointerdown', { bubbles: true, cancelable: true });
    await act(async () => first.dispatchEvent(pointer));
    expect(pointer.defaultPrevented).toBe(true);

    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    await act(async () => mounted.editor.view.dom.dispatchEvent(tab));
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    await act(async () => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(document.activeElement).toBe(actions[1]);
    await act(async () => actions[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
    expect(document.activeElement).toBe(first);
    await act(async () => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
    expect(document.activeElement).toBe(last);
    await act(async () => last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    expect(document.activeElement).toBe(first);
    await act(async () => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(document.activeElement).toBe(last);
    await act(async () =>
      last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })),
    );
    expect(document.activeElement).toBe(mounted.editor.view.dom);
    expect(mounted.editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(mounted.editor.state.selection.toJSON()).toEqual(fileSelection);
    await flushMenuUpdate();
    expect(document.querySelector('[data-testid="tiptap-file-menu"]')).toBeNull();
    await act(async () => mounted.editor.commands.setNodeSelection(1));
    await flushMenuUpdate();
    await act(async () => mounted.editor.commands.setNodeSelection(2));
    await flushMenuUpdate();
    expect(document.querySelector('[data-testid="tiptap-file-menu"]')).not.toBeNull();

    await controls.destroy();
    mounted.destroy();
  });

  it('keeps inline math editing in the paragraph instead of mounting a selection bubble', async () => {
    const mounted = createEditorWithBlock({
      type: 'paragraph',
      content: [{ type: 'mathInline', content: [{ type: 'text', text: 'x' }] }],
    });
    const controls = await renderControls(mounted.editor);
    await act(async () => {
      mounted.editor.view.focus();
      mounted.editor.commands.setTextSelection(4);
    });
    await flushMenuUpdate();

    const surfaceTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    await act(async () => mounted.editor.view.dom.dispatchEvent(surfaceTab));
    expect(surfaceTab.defaultPrevented).toBe(false);
    expect(document.querySelector('[data-testid="tiptap-mathInline-menu"]')).toBeNull();

    await controls.destroy();
    mounted.destroy();
  });
});
