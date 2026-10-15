// @vitest-environment node

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { describe, expect, it, vi } from 'vitest';
import { renderToReadableStream } from 'react-dom/server';

import { NextIntlClientProvider } from 'next-intl';
import {
  CodeBlockProps_Language,
  MissingAttachmentMediaKind,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { ContentBlockMediaRuntimeProvider } from '@/features/media/ContentBlockMediaRuntimeContext';
import { DocumentHeadingScope } from '@/features/document-layout/ui/DocumentHeadingScope';
import type { DocumentHeadingParentLevel } from '@/features/document-layout/ui/document-heading-level';
import enMessages from '@/messages/en.json';
import { GeneratedRichTextBlockView } from './GeneratedRichTextBlockView';

// App Router's real lazy SSR implementation preserves nested heavy-block loading.
vi.mock('next/dynamic', async () => {
  const { default: dynamic } = await vi.importActual<{ default: typeof import('next/dynamic').default }>(
    'next/dist/shared/lib/app-dynamic.js',
  );
  return { default: dynamic };
});

async function renderGeneratedStream(
  block: LocalizedRichTextBlock,
  headingParentLevel: DocumentHeadingParentLevel = 0,
): Promise<string> {
  const stream = await renderToReadableStream(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
      <DesignSystemProvider locale="en" forceColorScheme="light">
        <ContentBlockMediaRuntimeProvider items={[]}>
          <DocumentHeadingScope parentLevel={headingParentLevel}>
            <GeneratedRichTextBlockView block={block} />
          </DocumentHeadingScope>
        </ContentBlockMediaRuntimeProvider>
      </DesignSystemProvider>
    </NextIntlClientProvider>,
  );
  await stream.allReady;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let html = '';
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) {
      return html + decoder.decode();
    }
    html += decoder.decode(chunk.value, { stream: true });
  }
}

describe('GeneratedRichTextBlockView lazy SSR', () => {
  it('server-renders authored headings below the document title with the authored level and id', async () => {
    const heading: LocalizedRichTextBlock = {
      id: 'scope',
      kind: 'heading',
      base: { props: { level: 1 } },
      locale: { props: {}, content: [{ value: { case: 'text', value: { text: 'Scope' } } }] },
      children: [],
    } as unknown as LocalizedRichTextBlock;
    const titled = await renderGeneratedStream(heading, 1);
    expect(titled).toMatch(/<h2[^>]*\bid="scope"[^>]*\bdata-heading-level="1"[^>]*><span>Scope<\/span><\/h2>/u);
    expect(titled).not.toContain('<h1');
    expect(await renderGeneratedStream(heading)).toMatch(
      /<h1[^>]*\bdata-heading-level="1"[^>]*><span>Scope<\/span><\/h1>/u,
    );
  });

  it('renders inline and display math within nested structural rich text', async () => {
    const html = await renderGeneratedStream({
      id: 'math-callout',
      kind: 'callout',
      base: { props: {} },
      locale: {
        props: {},
        content: [{ value: { case: 'mathInline', value: { source: 'x^2' } } }],
      },
      children: [
        {
          id: 'display-math',
          kind: 'math',
          base: { props: { latex: 'y^2' } },
          locale: { props: {} },
          children: [],
        },
      ],
    } as unknown as LocalizedRichTextBlock);

    expect(html).toContain('class="math-inline"');
    expect(html).toContain('class="math-block" data-latex="y^2"');
    expect(html.match(/class="katex"/gu)?.length).toBe(2);
  });

  it('keeps generated code source available in the server-rendered print surface', async () => {
    const html = await renderGeneratedStream({
      id: 'print-code',
      kind: 'code-block',
      base: { props: { language: CodeBlockProps_Language.TYPESCRIPT } },
      locale: { props: { title: 'Example' }, content: 'const answer = 42;' },
      children: [],
    } as unknown as LocalizedRichTextBlock);

    expect(html).toContain('data-code-block-print-source');
    expect(html).toContain('const answer = 42;');
  });

  it('keeps deleted generated media and its caption server-rendered', async () => {
    const html = await renderGeneratedStream({
      id: '00000000-0000-4000-8000-000000000001',
      kind: 'file',
      base: {
        props: {
          attachment: {
            state: {
              case: 'missingAttachment',
              value: { mediaKind: MissingAttachmentMediaKind.IMAGE },
            },
          },
        },
      },
      locale: { props: { caption: 'Archived photograph' } },
      children: [],
    } as unknown as LocalizedRichTextBlock);

    expect(html).toContain('data-media-missing-kind="image"');
    expect(html).toContain('This image was deleted.');
    expect(html).toContain('Archived photograph');
  });
});
