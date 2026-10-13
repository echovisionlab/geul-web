// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { HeadingBlockSchema, HeadingBlockLocaleSchema } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { LocalizedPageSection } from '@/features/editor/contract/localized-page';
import type { Block } from '@/lib/types/page-content';
import { buildBlockTocItems, buildGeneratedPageTocItems, buildHtmlTocDocument, getInlinePlainText } from './toc-items';

describe('buildGeneratedPageTocItems', () => {
  const section = (id: string, label: string): LocalizedPageSection => ({
    id: `${id}-section`,
    kind: 'rich-text',
    settings: {},
    props: {},
    columns: [],
    richText: [
      {
        id,
        kind: 'heading',
        children: [],
        base: create(HeadingBlockSchema, { props: { level: 2 } }),
        locale: create(HeadingBlockLocaleSchema, {
          content: [{ value: { case: 'text', value: { text: label } } }],
        }),
      },
    ],
  });

  it('preserves renderer reading order across sections and nested columns', () => {
    const columns: LocalizedPageSection = {
      id: 'columns',
      kind: 'columns',
      settings: {},
      props: {},
      richText: null,
      columns: [
        { id: 'left', ratio: 1, sections: [section('second', ' Left heading ')] },
        { id: 'right', ratio: 1, sections: [section('third', 'Right heading')] },
      ],
    };
    expect(buildGeneratedPageTocItems([section('first', 'First'), columns, section('empty', ' ')])).toEqual([
      { id: 'first', label: 'First', level: 2 },
      { id: 'second', label: 'Left heading', level: 2 },
      { id: 'third', label: 'Right heading', level: 2 },
    ]);
  });
  it('omits headings for absent content and non-rich-text sections', () => {
    expect(buildGeneratedPageTocItems(null)).toEqual([]);
    expect(buildGeneratedPageTocItems([{ ...section('map', 'Hidden'), kind: 'map' }])).toEqual([]);
  });
});

describe('getInlinePlainText', () => {
  it('flattens text, links, and inline math in document order', () => {
    expect(
      getInlinePlainText([
        { type: 'text', text: 'Hello ', styles: {} },
        {
          type: 'link',
          content: [
            { type: 'text', text: 'linked', styles: {} },
            { type: 'mathInline', props: { latex: 'x^2' } },
          ],
          href: '/linked',
        },
      ]),
    ).toBe('Hello linkedx^2');
  });
});

describe('buildBlockTocItems', () => {
  it('returns a depth-first heading table of contents from rich text blocks', () => {
    const blocks = [
      headingBlock('intro', 1, 'Intro'),
      paragraphBlock('copy'),
      {
        ...paragraphBlock('parent'),
        children: [headingBlock('child', 3, 'Nested')],
      },
      headingBlock('empty', 2, '   '),
    ];

    expect(buildBlockTocItems(blocks)).toEqual([
      { id: 'intro', label: 'Intro', level: 1 },
      { id: 'child', label: 'Nested', level: 3 },
    ]);
  });

  it('falls back to level 1 when a heading level is missing or invalid', () => {
    const block = {
      ...headingBlock('bad-level', 2, 'Bad level'),
      props: { level: 'nope' },
    };

    expect(buildBlockTocItems([block])).toEqual([{ id: 'bad-level', label: 'Bad level', level: 1 }]);
  });
});

describe('buildHtmlTocDocument', () => {
  it('adds stable heading ids and preserves existing ids', () => {
    const result = buildHtmlTocDocument(`
      <article>
        <h2>Release Notes</h2>
        <h3 id="known-id">Fixed</h3>
        <h2>Release Notes</h2>
        <h4>한국어 제목</h4>
        <p>Body</p>
      </article>
    `);

    expect(result.tocItems).toEqual([
      { id: 'release-notes', label: 'Release Notes', level: 2 },
      { id: 'known-id', label: 'Fixed', level: 3 },
      { id: 'release-notes-1', label: 'Release Notes', level: 2 },
      { id: '한국어-제목', label: '한국어 제목', level: 4 },
    ]);
    expect(result.html).toContain('<h2 id="release-notes">Release Notes</h2>');
    expect(result.html).toContain('<h3 id="known-id">Fixed</h3>');
    expect(result.html).toContain('<h2 id="release-notes-1">Release Notes</h2>');
  });

  it('keeps the authored depth of headings demoted below a document title', () => {
    expect(
      buildHtmlTocDocument('<h2 data-heading-level="1">Scope</h2><h3 data-heading-level="2">Definitions</h3>').tocItems,
    ).toEqual([
      { id: 'scope', label: 'Scope', level: 1 },
      { id: 'definitions', label: 'Definitions', level: 2 },
    ]);
  });

  it('ignores empty headings and returns empty output for absent html', () => {
    expect(buildHtmlTocDocument('<h2> </h2><h3>Real</h3>').tocItems).toEqual([{ id: 'real', label: 'Real', level: 3 }]);
    expect(buildHtmlTocDocument(null)).toEqual({ html: '', tocItems: [] });
  });
});

function headingBlock(id: string, level: number, text: string): Block {
  return {
    id,
    type: 'heading',
    props: { level },
    content: [{ type: 'text', text, styles: {} }],
    children: [],
  } as Block;
}

function paragraphBlock(id: string): Block {
  return {
    id,
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Body', styles: {} }],
    children: [],
  } as Block;
}
