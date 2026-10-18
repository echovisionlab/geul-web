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
import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { siteVariableManifest } from '@/features/editor/tiptap/site-variables/site-variable.story-fixtures';
import {
  resolvedSiteVariableLinkLabel,
  siteVariableLinkBlock,
  siteVariableHrefCases,
  siteVariableHrefBlock,
} from '@/test/site-variable-link';
import enMessages from '@/messages/en.json';
import { GeneratedRichTextBlockView } from './GeneratedRichTextBlockView';

const browserEditorImports = vi.hoisted(() => vi.fn());

vi.mock('@/features/editor/tiptap/code-editor/MonacoSourceEditorRuntime', () => {
  browserEditorImports();
  return { MonacoSourceEditorRuntime: () => null };
});

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
  manifest = siteVariableManifest,
): Promise<string> {
  const stream = await renderToReadableStream(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
      <ManifestProvider manifest={manifest}>
        <DesignSystemProvider locale="en" forceColorScheme="light">
          <ContentBlockMediaRuntimeProvider items={[]}>
            <DocumentHeadingScope parentLevel={headingParentLevel}>
              <GeneratedRichTextBlockView block={block} />
            </DocumentHeadingScope>
          </ContentBlockMediaRuntimeProvider>
        </DesignSystemProvider>
      </ManifestProvider>
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
  it.each(siteVariableHrefCases)('SSR resolves href: $name', async ({ source, expected, settings }) => {
    const html = await renderGeneratedStream(siteVariableHrefBlock(source), 0, {
      ...siteVariableManifest,
      settings: { ...siteVariableManifest.settings, ...settings },
    });
    expect(html).toContain('<strong>Contact</strong>');
    if (expected) {
      expect(html).toContain(`href="${expected}"`);
    } else {
      expect(html).not.toContain('<a ');
    }
  });

  it('SSR resolves the six exact link-label tokens through the lazy reader', async () => {
    const html = await renderGeneratedStream(siteVariableLinkBlock);
    expect(html).toContain(`href="/tools/hwp"`);
    expect(html).toContain(`<strong>${resolvedSiteVariableLinkLabel}</strong>`);
  });

  it('SSR resolves variables and links from the manifest, escapes values and omits empty anchors', async () => {
    const html = await renderGeneratedStream(
      {
        id: 'variables',
        kind: 'paragraph',
        base: { props: {} },
        children: [],
        locale: {
          props: {},
          content: [
            { value: { case: 'siteVariable', value: { key: 'site.title', styles: { bold: true } } } },
            { value: { case: 'siteVariable', value: { key: 'contact.email', linked: true } } },
            { value: { case: 'siteVariable', value: { key: 'contact.legalEmail', linked: true } } },
          ],
        },
      } as unknown as LocalizedRichTextBlock,
      0,
      {
        ...siteVariableManifest,
        settings: { ...siteVariableManifest.settings, site_title: 'Raw & <sector>', legal_email: '' },
      },
    );
    expect(html).toContain('<strong>Raw &amp; &lt;sector&gt;</strong>');
    expect(html).toContain('href="mailto:contact@example.com"');
    expect(html).not.toContain('mailto:legal');
    expect(html).not.toContain('data-site-variable');
    expect(html).not.toContain('{{');
    expect(html).not.toContain('<button');
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
    expect(html).toMatch(/<pre[^>]*><code>const answer = 42;<\/code><\/pre>/u);
    expect(html).toContain('data-source-editor="monaco"');
    expect(browserEditorImports).not.toHaveBeenCalled();
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
