// @vitest-environment jsdom

import { Editor, getSchema, Node, type Extensions, type JSONContent } from '@tiptap/core';
import Emoji from '@tiptap/extension-emoji';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { geulTiptapEmojis } from './emoji-data';
import { GeulTiptapEmoji } from './emoji-extension';
import { getTiptapEmojiData, loadTiptapEmojiData } from './emoji-runtime';
import { documentToTiptap, parseDocument, splitPayload } from '../block-room-tiptap-codec';
import { richTextProseMirrorAdapterForProtoCase } from '../block-room-prosemirror-registry';
import { createTiptapWireExtensions } from '../wire-schema';

const TestDocument = Node.create({ name: 'doc', topNode: true, content: 'paragraph+' });
const TestParagraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML: () => [{ tag: 'p' }],
  renderHTML: () => ['p', 0],
});
const TestText = Node.create({ name: 'text', group: 'inline' });
const base = [TestDocument, TestParagraph, TestText];
const official = Emoji.configure({ emojis: [...geulTiptapEmojis] });

// jsdom lacks the clipboard constructors Tiptap uses to run paste rules for inserted content.
class TestDataTransfer {
  readonly #data = new Map<string, string>();
  setData(type: string, value: string) {
    this.#data.set(type, value);
  }
  getData(type: string) {
    return this.#data.get(type) ?? '';
  }
}
class TestClipboardEvent extends Event {
  readonly clipboardData: TestDataTransfer | null;
  constructor(type: string, init?: { clipboardData?: TestDataTransfer }) {
    super(type);
    this.clipboardData = init?.clipboardData ?? null;
  }
}
globalThis.DataTransfer ??= TestDataTransfer as unknown as typeof DataTransfer;
globalThis.ClipboardEvent ??= TestClipboardEvent as unknown as typeof ClipboardEvent;

const mounted: { editor: Editor; element: HTMLElement }[] = [];
function mount(extensions: Extensions, content = '<p></p>') {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({ element, extensions: [...base, ...extensions], content });
  mounted.push({ editor, element });
  return editor;
}

function typeText(editor: Editor, text: string) {
  for (const character of text) {
    const position = editor.state.selection.from;
    const handled = editor.view.someProp('handleTextInput', (handler) =>
      handler(editor.view, position, position, character, () => editor.state.tr),
    );
    if (!handled) {
      editor.view.dispatch(editor.state.tr.insertText(character, position));
    }
  }
}

afterEach(() => {
  for (const { editor, element } of mounted.splice(0)) {
    editor.destroy();
    element.remove();
  }
});

describe('GeulTiptapEmoji', () => {
  it('keeps the official Emoji node schema', () => {
    const shape = (extension: typeof GeulTiptapEmoji | typeof official) => {
      const { spec } = getSchema([...base, extension]).nodes.emoji!;
      return {
        inline: spec.inline,
        group: spec.group,
        selectable: spec.selectable,
        attrs: spec.attrs,
        parseDOM: spec.parseDOM?.map((rule) => rule.tag),
      };
    };
    expect(shape(GeulTiptapEmoji)).toEqual(shape(official));
  });

  it('does not load Emoji data with the editor and loads it when the editor receives focus', async () => {
    const editor = mount([GeulTiptapEmoji]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getTiptapEmojiData()).toBeNull();
    editor.view.dom.dispatchEvent(new FocusEvent('focus'));
    await vi.waitFor(() => expect(getTiptapEmojiData()?.find('smile')?.emoji).toBe('😄'));
  });

  it('redraws Emoji nodes that exist before the data has loaded', async () => {
    vi.resetModules();
    const fresh = await import('./emoji-extension');
    const freshRuntime = await import('./emoji-runtime');
    const editor = mount([fresh.GeulTiptapEmoji], '<p><span data-type="emoji" data-name="smile"></span></p>');
    expect(freshRuntime.getTiptapEmojiData()).toBeNull();
    expect(editor.view.dom.textContent).toBe(':smile:');
    await freshRuntime.loadTiptapEmojiData();
    expect(editor.view.dom.textContent).toBe('😄');
    const reference = mount([official], editor.getHTML());
    expect(editor.getHTML()).toBe(reference.getHTML());
    expect(editor.view.dom.innerHTML).toBe(reference.view.dom.innerHTML);
  });

  it('converts shortcodes, pasted shortcodes and Unicode Emoji like the official extension', async () => {
    await loadTiptapEmojiData();
    const results = [GeulTiptapEmoji, official].map((extension) => {
      const editor = mount([extension]);
      editor.commands.focus('end');
      typeText(editor, 'Hi :smile: ');
      editor.commands.insertContent(' and 🎉 ');
      editor.commands.insertContent(' pasted :heart: ', { applyPasteRules: true });
      return { json: editor.getJSON(), html: editor.getHTML(), text: editor.getText() };
    });
    expect(JSON.stringify(results[0]!.json)).toContain('"name":"smile"');
    expect(JSON.stringify(results[0]!.json)).toContain('"name":"party"');
    expect(JSON.stringify(results[0]!.json)).toContain('"name":"heart"');
    expect(results[0]).toEqual(results[1]);
  });

  it('stores the official Tiptap Emoji node as locale Unicode text', async () => {
    await loadTiptapEmojiData();
    const smile = geulTiptapEmojis.find((item) => item.shortcodes.includes('smile'));
    if (!smile?.emoji) {
      throw new Error('Official Emoji data is missing :smile:.');
    }
    const input = documentToTiptap([
      {
        id: '10000000-0000-4000-8000-000000000223',
        adapter: richTextProseMirrorAdapterForProtoCase('paragraph'),
        basePayload: { props: {} },
        localePayload: { props: {}, content: [] },
        children: [],
      },
    ]);
    const paragraph = input.content?.[0]?.content?.[0]?.content?.[0];
    if (!paragraph) {
      throw new Error('Expected Emoji paragraph fixture.');
    }
    paragraph.content = [{ type: 'emoji', attrs: { name: smile.name } }];
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: createTiptapWireExtensions(),
      content: input,
    });

    try {
      const parsed = parseDocument(editor.getJSON() as JSONContent);
      expect(splitPayload(parsed[0]!).locale.content).toEqual([{ text: { text: smile.emoji, styles: {} } }]);
    } finally {
      editor.destroy();
    }
  });
});
