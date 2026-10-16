// @vitest-environment jsdom
import { Editor, getSchema, type JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createTiptapWireExtensions } from './wire-schema';
import { createMarkdownPasteExtension, markdownBlocks } from './markdown-paste';

const schema = getSchema(createTiptapWireExtensions());
const sample =
  '# Heading\n\n**bold** *italic* `code` ~~strike~~ [link](https://example.com)\n\n- parent\n  1. child\n     - [x] done\n\n> quote\n\n```js\nconst x = 1\n```\n\n---\n\n| A | B |\n| - | - |\n| 1 | 2 |';
describe('markdown paste', () => {
  it('uses CommonMark/GFM for nested blocks, marks and tables', () => {
    const blocks = markdownBlocks(sample, schema)!;
    expect(blocks).not.toBeNull();
    expect(blocks.map((block) => block.content![0].type)).toEqual([
      'heading',
      'paragraph',
      'bulletListItem',
      'quote',
      'codeBlock',
      'divider',
      'table',
    ]);
    expect(JSON.stringify(blocks)).toContain('numberedListItem');
    expect(JSON.stringify(blocks)).toContain('checkListItem');
    expect(blocks[1].content![0].content!.flatMap((node) => node.marks?.map((mark) => mark.type) ?? [])).toEqual([
      'bold',
      'italic',
      'code',
      'strike',
      'link',
    ]);
    blocks.forEach((block) => schema.nodeFromJSON(block).check());
  });
  it.each([true, false])('pastes through the editor with structural authority=%s', (allowed) => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), createMarkdownPasteExtension(() => allowed)],
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [{ type: 'blockContainer', attrs: { id: crypto.randomUUID() }, content: [{ type: 'paragraph' }] }],
          },
        ],
      },
    });
    const event = {
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? sample : '') },
    } as unknown as ClipboardEvent;
    const handled = editor.view.someProp('handlePaste', (handler) =>
      handler(editor.view, event, editor.state.doc.slice(0, 0)),
    );
    expect(Boolean(handled)).toBe(allowed);
    if (allowed) {
      expect(editor.state.doc.firstChild?.firstChild?.firstChild?.type.name).toBe('heading');
    } else {
      expect(editor.state.doc.textContent).toBe('');
    }
    editor.destroy();
  });
  it('leaves ordinary text and escaped syntax alone and sanitizes links', () => {
    expect(markdownBlocks('ordinary text', schema)?.[0].content?.[0].content).toEqual([
      { type: 'text', text: 'ordinary text' },
    ]);
    expect(markdownBlocks('\\*literal\\*', schema)?.[0].content?.[0].content).toEqual([
      { type: 'text', text: '*literal*' },
    ]);
    expect(JSON.stringify(markdownBlocks('[bad](javascript:alert%281%29)', schema))).not.toMatch(/javascript:/);
  });
});

it('preserves unsupported image references by falling back to plain text', () => {
  expect(markdownBlocks('# Heading\n\n![diagram](https://example.com/a.png)', schema)).toBeNull();
});
it('keeps loose-list paragraphs and nested fenced code as child blocks', () => {
  const blocks = markdownBlocks('- first paragraph\n\n  second paragraph\n\n  ```js\n  const x = 1\n  ```', schema)!;
  expect(blocks[0].content![0].content).toEqual([{ type: 'text', text: 'first paragraph' }]);
  expect(
    blocks[0].content![1].content!.map((node) => (node.type === 'blockContainer' ? node.content![0].type : '')),
  ).toEqual(['paragraph', 'codeBlock']);
});

it.each(['- **a** **b**', '- [x] **a** **b**'])('preserves inline spacing in %s', (source) => {
  const blocks = markdownBlocks(source, schema)!;
  expect(blocks[0].content![0].content!.map((node) => node.text ?? '').join('')).toBe('a b');
});

it('imports soft Markdown line breaks as hardBreak nodes without losing styled text', () => {
  const blocks = markdownBlocks('**a\nb**\n\nnext', schema);
  expect(blocks?.[0]?.content?.[0]?.content).toEqual([
    { type: 'text', text: 'a', marks: [{ type: 'bold' }] },
    { type: 'hardBreak' },
    { type: 'text', text: 'b', marks: [{ type: 'bold' }] },
  ]);
});

const emptyContent = () => ({
  type: 'doc',
  content: [
    {
      type: 'blockGroup',
      content: [{ type: 'blockContainer', attrs: { id: crypto.randomUUID() }, content: [{ type: 'paragraph' }] }],
    },
  ],
});
const pastedParagraphs = (editor: Editor) =>
  (editor.getJSON() as JSONContent).content![0].content!.map((block) => block.content![0]);

it.each(['a\nb\nc', 'a  \nb\nc', 'a\\\nb\nc', 'a\r\nb\r\nc'])('imports hard breaks once: %j', (text) => {
  expect(markdownBlocks(text, schema)?.[0].content?.[0].content).toEqual([
    { type: 'text', text: 'a' },
    { type: 'hardBreak' },
    { type: 'text', text: 'b' },
    { type: 'hardBreak' },
    { type: 'text', text: 'c' },
  ]);
});

it.each(['clipboard', 'plain-parser'])('pastes ordinary newlines with the GitHub policy via %s', (path) => {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [...createTiptapWireExtensions(), createMarkdownPasteExtension(() => true)],
    content: emptyContent(),
  });
  if (path === 'clipboard') {
    editor.view.someProp('handlePaste', (handler) =>
      handler(
        editor.view,
        { clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'a\nb\n\nc' : '') } } as ClipboardEvent,
        editor.state.doc.slice(0, 0),
      ),
    );
  } else {
    editor.view.pasteText('a\nb\n\nc', new Event('paste') as ClipboardEvent);
  }
  expect(pastedParagraphs(editor).map((node) => node.content)).toEqual([
    [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }],
    [{ type: 'text', text: 'c' }],
  ]);
  editor.destroy();
});

it('inserts a single paragraph into existing text without splitting the block', () => {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [...createTiptapWireExtensions(), createMarkdownPasteExtension(() => true)],
    content: emptyContent(),
  });
  editor.commands.insertContent('prefix suffix');
  editor.commands.setTextSelection(10);
  editor.view.pasteText('a\nb', new Event('paste') as ClipboardEvent);
  expect(pastedParagraphs(editor)).toHaveLength(1);
  expect(editor.state.doc.textContent).toBe('prefix a' + 'bsuffix');
  expect(editor.getHTML()).toContain('a<br>b');
  editor.destroy();
});

it('keeps the destination heading when pasting plain text into an empty heading', () => {
  const content = emptyContent();
  content.content[0].content[0].content[0].type = 'heading';
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [...createTiptapWireExtensions(), createMarkdownPasteExtension(() => true)],
    content,
  });
  editor.view.someProp('handlePaste', (handler) =>
    handler(
      editor.view,
      { clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'a\nb' : '') } } as ClipboardEvent,
      editor.state.doc.slice(0, 0),
    ),
  );
  expect(editor.state.doc.firstChild!.firstChild!.firstChild!.type.name).toBe('heading');
  expect(editor.getHTML()).toContain('a<br>b');
  editor.destroy();
});

it('keeps a pasted Markdown heading as a block inside an existing paragraph', () => {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [...createTiptapWireExtensions(), createMarkdownPasteExtension(() => true)],
    content: emptyContent(),
  });
  editor.commands.insertContent('prefix suffix');
  editor.commands.setTextSelection(10);
  editor.view.someProp('handlePaste', (handler) =>
    handler(
      editor.view,
      {
        clipboardData: { getData: (type: string) => (type === 'text/plain' ? '# Heading\n\n- item' : '') },
      } as ClipboardEvent,
      editor.state.doc.slice(0, 0),
    ),
  );
  expect(pastedParagraphs(editor).map((node) => node.type)).toEqual([
    'paragraph',
    'heading',
    'bulletListItem',
    'paragraph',
  ]);
  expect(pastedParagraphs(editor)[1].content).toEqual([{ type: 'text', text: 'Heading' }]);
  editor.destroy();
});
