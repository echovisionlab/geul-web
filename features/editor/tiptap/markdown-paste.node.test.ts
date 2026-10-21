import { getSchema, type JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createTiptapWireExtensions } from './wire-schema';
import { markdownBlocks, type MarkdownImagePlaceholder } from './markdown-paste';

const schema = getSchema(createTiptapWireExtensions());
const sample =
  '# Heading\n\n**bold** *italic* `code` ~~strike~~ [link](https://example.com)\n\n- parent\n  1. child\n     - [x] done\n\n> quote\n\n```js\nconst x = 1\n```\n\n---\n\n| A | B |\n| - | - |\n| 1 | 2 |';
describe('markdownBlocks', () => {
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

const blockText = (block: JSONContent) =>
  (block.content![0].content ?? []).map((node) => (node.type === 'text' ? node.text : '\n')).join('');
const linkTarget = (block: JSONContent) =>
  block.content![0].content?.[0]?.marks?.find((mark) => mark.type === 'link')?.attrs?.href;

it('keeps images as links so the surrounding Markdown still converts', () => {
  const blocks = markdownBlocks(
    '# Heading\n\n![diagram](https://example.com/a.png) and [![logo](https://example.com/l.png)](https://example.com)\n\n![](https://example.com/b.png)',
    schema,
  )!;
  expect(blocks.map((block) => block.content![0].type)).toEqual(['heading', 'paragraph', 'paragraph']);
  expect(blocks[1].content![0].content).toEqual([
    { type: 'text', text: 'diagram', marks: [{ type: 'link', attrs: { href: 'https://example.com/a.png' } }] },
    { type: 'text', text: ' and ' },
    { type: 'text', text: 'logo', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
  ]);
  expect(blockText(blocks[2])).toBe('https://example.com/b.png');
});

it('collects only HTTPS images written on their own line as import placeholders', () => {
  const images: MarkdownImagePlaceholder[] = [];
  const blocks = markdownBlocks(
    'Intro\n![A](https://example.com/a.png)\nafter\n\n- item ![B](https://example.com/b.png)\n\n![C](./c.png) ![D](https://example.com/d.png)\n\n![E](http://example.com/e.png)',
    schema,
    { images },
  )!;
  expect(blocks.map(blockText)).toEqual(['Intro', 'A', 'after', 'item B', 'C', 'D', 'E']);
  expect(images.map(({ alt, url }) => [alt, url])).toEqual([
    ['A', 'https://example.com/a.png'],
    ['D', 'https://example.com/d.png'],
  ]);
  expect(images.map((image) => image.blockId)).toEqual([blocks[1].attrs!.id, blocks[5].attrs!.id]);
  expect(linkTarget(blocks[4])).toBe('./c.png');
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

it.each(['a\nb\nc', 'a  \nb\nc', 'a\\\nb\nc', 'a\r\nb\r\nc'])('imports hard breaks once: %j', (text) => {
  expect(markdownBlocks(text, schema)?.[0].content?.[0].content).toEqual([
    { type: 'text', text: 'a' },
    { type: 'hardBreak' },
    { type: 'text', text: 'b' },
    { type: 'hardBreak' },
    { type: 'text', text: 'c' },
  ]);
});
