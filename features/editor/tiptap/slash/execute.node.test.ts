import { Editor } from '@tiptap/core';
import { expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import { createTiptapWireExtensions } from '../wire-schema';
import { createTiptapSlashCatalog } from './catalog';
import { executeTiptapSlashItem } from './execute';
import type { TiptapSlashMenuMessages } from './types';

const serializedSlashMessages = enMessages.editorCommon.editor.slashMenu;
function splitItemAliases<Item extends { aliases: string }>(item: Item) {
  return { ...item, aliases: item.aliases.split('\n') };
}

const slashMessages = {
  ...serializedSlashMessages,
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
    siteVariable: splitItemAliases(serializedSlashMessages.items.siteVariable),
    mathBlock: splitItemAliases(serializedSlashMessages.items.mathBlock),
    inlineMath: splitItemAliases(serializedSlashMessages.items.inlineMath),
    map: splitItemAliases(serializedSlashMessages.items.map),
    externalVideo: splitItemAliases(serializedSlashMessages.items.externalVideo),
    mermaid: splitItemAliases(serializedSlashMessages.items.mermaid),
    p5Sketch: splitItemAliases(serializedSlashMessages.items.p5Sketch),
    threeScene: splitItemAliases(serializedSlashMessages.items.threeScene),
    shader: splitItemAliases(serializedSlashMessages.items.shader),
    file: splitItemAliases(serializedSlashMessages.items.file),
  },
} satisfies TiptapSlashMenuMessages;

it('does nothing when a capability item is unavailable', () => {
  // No `element`: the editor keeps its state without an EditorView.
  const editor = new Editor({
    element: null,
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
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '/p5' }] }],
            },
          ],
        },
      ],
    },
  });
  const range = { from: 3, to: 6, contentPosition: 2, blockId: 'slash-target' };
  editor.commands.setTextSelection(range.to);
  // The capability alone leaves the item disabled: the catalog was built without a p5 callback.
  const p5 = createTiptapSlashCatalog(slashMessages, { capabilities: { p5: true } }).find((item) => item.key === 'p5');
  const callback = vi.fn();
  const onTransaction = vi.fn();
  editor.on('transaction', onTransaction);
  const before = editor.getJSON();

  expect(p5?.enabled).toBe(false);
  expect(executeTiptapSlashItem({ editor, item: p5!, range, callbacks: { p5: callback } })).toEqual({
    status: 'unavailable',
  });
  expect(callback).not.toHaveBeenCalled();
  expect(onTransaction).not.toHaveBeenCalled();
  expect(editor.getJSON()).toEqual(before);
  editor.destroy();
});
