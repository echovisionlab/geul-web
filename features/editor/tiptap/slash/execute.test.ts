// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import { createTiptapWireExtensions } from '../wire-schema';
import { geulTiptapEmojis } from '../emoji/emoji-extension';
import { createTiptapSlashCatalog } from './catalog';
import { applyTiptapSlashEmoji, executeTiptapSlashItem } from './execute';
import type { TiptapSlashCapabilities, TiptapSlashMenuMessages, TiptapSlashRange } from './types';

const serializedSlashMessages = enMessages.editorCommon.editor.slashMenu;

function splitItemAliases<Item extends { aliases: string }>(item: Item) {
  return { ...item, aliases: item.aliases.split('\n') };
}

const slashMessages = {
  placeholder: serializedSlashMessages.placeholder,
  unavailable: serializedSlashMessages.unavailable,
  groups: serializedSlashMessages.groups,
  items: {
    heading: splitItemAliases(serializedSlashMessages.items.heading),
    heading2: splitItemAliases(serializedSlashMessages.items.heading2),
    heading3: splitItemAliases(serializedSlashMessages.items.heading3),
    paragraph: splitItemAliases(serializedSlashMessages.items.paragraph),
    bulletList: splitItemAliases(serializedSlashMessages.items.bulletList),
    numberedList: splitItemAliases(serializedSlashMessages.items.numberedList),
    checkList: splitItemAliases(serializedSlashMessages.items.checkList),
    quote: splitItemAliases(serializedSlashMessages.items.quote),
    callout: splitItemAliases(serializedSlashMessages.items.callout),
    divider: splitItemAliases(serializedSlashMessages.items.divider),
    codeBlock: splitItemAliases(serializedSlashMessages.items.codeBlock),
    table: splitItemAliases(serializedSlashMessages.items.table),
    emoji: splitItemAliases(serializedSlashMessages.items.emoji),
    mathBlock: splitItemAliases(serializedSlashMessages.items.mathBlock),
    inlineMath: splitItemAliases(serializedSlashMessages.items.inlineMath),
    map: splitItemAliases(serializedSlashMessages.items.map),
    externalVideo: splitItemAliases(serializedSlashMessages.items.externalVideo),
    p5Sketch: splitItemAliases(serializedSlashMessages.items.p5Sketch),
    threeScene: splitItemAliases(serializedSlashMessages.items.threeScene),
    shader: splitItemAliases(serializedSlashMessages.items.shader),
    file: splitItemAliases(serializedSlashMessages.items.file),
    aiAssistant: splitItemAliases(serializedSlashMessages.items.aiAssistant),
  },
} satisfies TiptapSlashMenuMessages;

function mountEditor(text: string) {
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
              attrs: { id: 'slash-target' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
            },
          ],
        },
      ],
    },
  });
  const range: TiptapSlashRange = {
    from: 3,
    to: 3 + text.length,
    contentPosition: 2,
    blockId: 'slash-target',
  };
  editor.commands.setTextSelection(range.to);
  return {
    editor,
    range,
    destroy() {
      editor.destroy();
      element.remove();
    },
  };
}

function requiredItem(items: ReturnType<typeof createTiptapSlashCatalog>, key: string) {
  const result = items.find((candidate) => candidate.key === key);
  if (!result) {
    throw new Error(`Missing slash item: ${key}`);
  }
  return result;
}

function item(key: string, capabilities: TiptapSlashCapabilities = {}) {
  return requiredItem(
    createTiptapSlashCatalog(slashMessages, {
      capabilities,
    }),
    key,
  );
}

describe('Tiptap slash execution', () => {
  it('converts the current Paragraph into a writable Callout body in one transaction', () => {
    const mounted = mountEditor('/callout');
    const onTransaction = vi.fn();
    mounted.editor.on('transaction', onTransaction);

    expect(executeTiptapSlashItem({ editor: mounted.editor, item: item('callout'), range: mounted.range })).toEqual({
      status: 'applied',
      editorMutations: 1,
    });
    expect(onTransaction).toHaveBeenCalledTimes(1);
    const container = mounted.editor.state.doc.firstChild?.firstChild;
    expect(container?.firstChild?.type.name).toBe('callout');
    expect(container?.firstChild?.attrs).toMatchObject({ icon: '💡', backgroundColor: 'gray', textColor: 'default' });
    expect(container?.childCount).toBe(1);
    expect(mounted.editor.state.selection.$from.parent.type.name).toBe('callout');
    mounted.destroy();
  });

  it('applies a block conversion in exactly one editor transaction', () => {
    const mounted = mountEditor('/heading');
    const onTransaction = vi.fn();
    mounted.editor.on('transaction', onTransaction);

    expect(executeTiptapSlashItem({ editor: mounted.editor, item: item('heading'), range: mounted.range })).toEqual({
      status: 'applied',
      editorMutations: 1,
    });
    expect(onTransaction).toHaveBeenCalledTimes(1);
    expect(mounted.editor.state.doc.nodeAt(2)?.type.name).toBe('heading');
    expect(mounted.editor.state.doc.nodeAt(2)?.attrs.level).toBe(1);
    expect(mounted.editor.getText()).not.toContain('/heading');
    mounted.destroy();
  });

  it('inserts inline math once without a callback gate', () => {
    const mounted = mountEditor('/math');
    const onTransaction = vi.fn();
    mounted.editor.on('transaction', onTransaction);

    expect(
      executeTiptapSlashItem({
        editor: mounted.editor,
        item: item('inline-math', { math: true }),
        range: mounted.range,
      }),
    ).toMatchObject({ status: 'applied', editorMutations: 1 });
    expect(onTransaction).toHaveBeenCalledTimes(1);
    expect(mounted.editor.state.doc.nodeAt(2)?.child(0).type.name).toBe('mathInline');
    mounted.destroy();
  });

  it('preserves preceding inline math source when the slash range starts after it', () => {
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
                attrs: { id: 'inline-prefix' },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'mathInline', content: [{ type: 'text', text: 'x' }] },
                      { type: 'text', text: ' /heading' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const paragraph = editor.state.doc.nodeAt(2);
    if (!paragraph) {
      throw new Error('Inline-prefix paragraph is missing');
    }
    const to = 3 + paragraph.content.size;
    const range = { from: to - '/heading'.length, to, contentPosition: 2, blockId: 'inline-prefix' };
    editor.commands.setTextSelection(to);

    expect(executeTiptapSlashItem({ editor, item: item('heading'), range })).toMatchObject({ status: 'applied' });
    const blocks = editor.getJSON().content?.[0]?.content ?? [];
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      attrs: { id: 'inline-prefix' },
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mathInline', content: [{ type: 'text', text: 'x' }] },
            { type: 'text', text: ' ' },
          ],
        },
      ],
    });
    expect(blocks[1]).toMatchObject({ content: [{ type: 'heading' }] });
    editor.destroy();
    element.remove();
  });

  it('moves a block conversion after adjacent inline math source without dropping content', () => {
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
                attrs: { id: 'mixed-target' },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'mathInline', content: [{ type: 'text', text: 'x' }] },
                      { type: 'text', text: '/code' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const paragraph = editor.state.doc.nodeAt(2);
    if (!paragraph) {
      throw new Error('Mixed-target paragraph is missing');
    }
    const to = 3 + paragraph.content.size;
    editor.commands.setTextSelection(to);
    const onTransaction = vi.fn();
    editor.on('transaction', onTransaction);

    expect(
      executeTiptapSlashItem({
        editor,
        item: item('code_block'),
        range: { from: to - '/code'.length, to, contentPosition: 2, blockId: 'mixed-target' },
      }),
    ).toEqual({ status: 'applied', editorMutations: 1 });
    expect(onTransaction).toHaveBeenCalledTimes(1);
    const blocks = editor.getJSON().content?.[0]?.content ?? [];
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      attrs: { id: 'mixed-target' },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'mathInline', content: [{ type: 'text', text: 'x' }] }],
        },
      ],
    });
    expect(blocks[1]).toMatchObject({ content: [{ type: 'codeBlock' }] });
    editor.destroy();
    element.remove();
  });

  it('rejects a stale block anchor without deleting text or dispatching a transaction', () => {
    const mounted = mountEditor('/heading');
    const before = mounted.editor.getJSON();
    const onTransaction = vi.fn();
    mounted.editor.on('transaction', onTransaction);

    expect(
      executeTiptapSlashItem({
        editor: mounted.editor,
        item: item('heading'),
        range: { ...mounted.range, blockId: 'different-block' },
      }),
    ).toEqual({ status: 'invalid' });
    expect(onTransaction).not.toHaveBeenCalled();
    expect(mounted.editor.getJSON()).toEqual(before);
    mounted.destroy();
  });

  it('replaces the slash block with the Geul-default 2 by 3 table in one transaction', () => {
    const mounted = mountEditor('/table');
    const onTransaction = vi.fn();
    mounted.editor.on('transaction', onTransaction);

    expect(
      executeTiptapSlashItem({ editor: mounted.editor, item: item('table', { table: true }), range: mounted.range }),
    ).toMatchObject({ status: 'applied', editorMutations: 1 });
    const table = mounted.editor.state.doc.nodeAt(2);
    expect(onTransaction).toHaveBeenCalledTimes(1);
    expect(table?.type.name).toBe('table');
    expect(table?.childCount).toBe(2);
    expect(table?.child(0).childCount).toBe(3);
    const identities = new Set<string>();
    table?.descendants((node) => {
      if (node.type.name === 'tableRow' || node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        expect(node.attrs.id).toMatch(/^[0-9a-f-]{36}$/u);
        identities.add(String(node.attrs.id));
      }
    });
    expect(identities.size).toBe(8);
    mounted.destroy();
  });

  it('opens the Emoji workflow without mutation and replaces the exact Slash query once on selection', () => {
    const mounted = mountEditor('Before /emoji');
    let context: Parameters<typeof applyTiptapSlashEmoji>[1] | undefined;
    const emojiItem = requiredItem(
      createTiptapSlashCatalog(slashMessages, {
        capabilities: { emoji: true },
        callbacks: {
          emoji: (value) => {
            context = value;
          },
        },
      }),
      'emoji',
    );
    const onTransaction = vi.fn();
    mounted.editor.on('transaction', onTransaction);

    expect(
      executeTiptapSlashItem({
        editor: mounted.editor,
        item: emojiItem,
        range: { ...mounted.range, from: mounted.range.to - '/emoji'.length },
        callbacks: {
          emoji: (value) => {
            context = value;
          },
        },
      }),
    ).toEqual({ status: 'delegated', editorMutations: 0, workflow: 'emoji' });
    expect(onTransaction).not.toHaveBeenCalled();
    const smile = geulTiptapEmojis.find((item) => item.shortcodes.includes('smile'));
    expect(smile?.name).toBeTruthy();
    expect(context && smile ? applyTiptapSlashEmoji(mounted.editor, context, smile.name) : false).toBe(true);
    expect(onTransaction).toHaveBeenCalledTimes(1);
    expect(mounted.editor.getText()).toContain(`Before ${smile?.emoji}`);
    expect(mounted.editor.getText()).not.toContain('/emoji');
    mounted.destroy();
  });

  it('delegates an external workflow once without deleting the slash query or inserting a placeholder', () => {
    const mounted = mountEditor('/map');
    const callback = vi.fn();
    const map = requiredItem(
      createTiptapSlashCatalog(slashMessages, {
        capabilities: { map: true },
        callbacks: { map: callback },
      }),
      'map',
    );
    const onTransaction = vi.fn();
    mounted.editor.on('transaction', onTransaction);
    const before = mounted.editor.getJSON();

    expect(
      executeTiptapSlashItem({ editor: mounted.editor, item: map, range: mounted.range, callbacks: { map: callback } }),
    ).toEqual({
      status: 'delegated',
      editorMutations: 0,
      workflow: 'map',
    });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ blockId: 'slash-target', range: mounted.range }));
    expect(Object.isFrozen(callback.mock.calls[0]?.[0])).toBe(true);
    expect(Object.isFrozen(callback.mock.calls[0]?.[0].range)).toBe(true);
    expect(onTransaction).not.toHaveBeenCalled();
    expect(mounted.editor.getJSON()).toEqual(before);
    mounted.destroy();
  });

  it('does nothing when a capability item is unavailable', () => {
    const mounted = mountEditor('/p5');
    const callback = vi.fn();
    const p5 = requiredItem(
      createTiptapSlashCatalog(slashMessages, {
        capabilities: { p5: true },
      }),
      'p5',
    );
    const before = mounted.editor.getJSON();

    expect(
      executeTiptapSlashItem({ editor: mounted.editor, item: p5, range: mounted.range, callbacks: { p5: callback } }),
    ).toEqual({
      status: 'unavailable',
    });
    expect(callback).not.toHaveBeenCalled();
    expect(mounted.editor.getJSON()).toEqual(before);
    mounted.destroy();
  });
});
