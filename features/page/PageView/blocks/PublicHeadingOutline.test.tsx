// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { DocumentHeadingScope } from '@/features/document-layout/ui/DocumentHeadingScope';
import type { DocumentHeadingParentLevel } from '@/features/document-layout/ui/document-heading-level';
import { ContentLayoutView } from '@/features/document-layout/ui/ContentLayoutView';
import { FLOW_DOCUMENT_LAYOUT } from '@/features/document-layout/ui/types';
import { GeneratedRichTextBlockView } from './GeneratedRichTextBlockViewRuntime';
import { DefaultBlockView } from './DefaultBlockView';

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
function render(element: React.ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<TestProviders>{element}</TestProviders>));
  return host;
}

function generatedHeading(level: number) {
  return (
    <GeneratedRichTextBlockView
      key={level}
      block={
        {
          id: `heading-${level}`,
          kind: 'heading',
          base: { props: { level } },
          locale: { content: [{ value: { case: 'text', value: { text: `Level ${level}` } } }] },
          children: [],
        } as unknown as LocalizedRichTextBlock
      }
    />
  );
}

function materializedHeading(level: number) {
  return (
    <DefaultBlockView
      key={level}
      block={
        {
          id: `heading-${level}`,
          type: 'heading',
          props: { level },
          content: [{ type: 'text', text: `Level ${level}`, styles: {} }],
          children: [],
        } as unknown as Parameters<typeof DefaultBlockView>[0]['block']
      }
    />
  );
}

function outline(host: HTMLElement) {
  return [...host.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((heading) => ({
    id: heading.id,
    tag: heading.tagName.toLowerCase(),
    authored: heading.getAttribute('data-heading-level'),
  }));
}

describe('Published authored heading outline', () => {
  it.each([
    [0, ['h1', 'h2', 'h3']],
    [1, ['h2', 'h3', 'h4']],
    [2, ['h3', 'h4', 'h5']],
  ] as const)('places generated H1–H3 below parent level %i', (parentLevel, tags) => {
    const host = render(
      <DocumentHeadingScope parentLevel={parentLevel as DocumentHeadingParentLevel}>
        {[1, 2, 3].map(generatedHeading)}
      </DocumentHeadingScope>,
    );
    expect(outline(host)).toEqual(
      tags.map((tag, index) => ({ id: `heading-${index + 1}`, tag, authored: String(index + 1) })),
    );
  });

  it('keeps the authored element outside any scope', () => {
    expect(outline(render(<>{[1, 2, 3].map(generatedHeading)}</>)).map((heading) => heading.tag)).toEqual([
      'h1',
      'h2',
      'h3',
    ]);
  });

  it('demotes materialized headings and caps the element at h6', () => {
    const host = render(
      <DocumentHeadingScope parentLevel={1}>{[1, 2, 3, 4, 5, 6].map(materializedHeading)}</DocumentHeadingScope>,
    );
    expect(outline(host)).toEqual([
      { id: 'heading-1', tag: 'h2', authored: '1' },
      { id: 'heading-2', tag: 'h3', authored: '2' },
      { id: 'heading-3', tag: 'h4', authored: '3' },
      { id: 'heading-4', tag: 'h5', authored: '4' },
      { id: 'heading-5', tag: 'h6', authored: '5' },
      { id: 'heading-6', tag: 'h6', authored: '6' },
    ]);
  });

  it('puts the body below the title when the document layout has chrome', () => {
    const titled = render(
      <ContentLayoutView layout={FLOW_DOCUMENT_LAYOUT} chrome={<h1>Document title</h1>}>
        {generatedHeading(1)}
      </ContentLayoutView>,
    );
    expect([...titled.querySelectorAll('h1, h2')].map((heading) => heading.tagName)).toEqual(['H1', 'H2']);
    expect(titled.querySelector('#heading-1')).toHaveAttribute('data-heading-level', '1');
    act(() => root?.unmount());
    host?.remove();

    const untitled = render(<ContentLayoutView layout={FLOW_DOCUMENT_LAYOUT}>{generatedHeading(1)}</ContentLayoutView>);
    expect(untitled.querySelector('#heading-1')?.tagName).toBe('H1');
  });
});
