// @vitest-environment jsdom
import { Editor, getSchema } from '@tiptap/core';
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
    expect(markdownBlocks('ordinary text', schema)).toBeNull();
    expect(markdownBlocks('\\*literal\\*', schema)).toBeNull();
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
