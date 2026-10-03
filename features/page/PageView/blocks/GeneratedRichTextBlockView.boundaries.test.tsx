// @vitest-environment node

import { renderToReadableStream } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { GeneratedRichTextBlockView } from './GeneratedRichTextBlockView';

const imports = vi.hoisted(() => ({ contentSchema: 0, code: 0, math: 0, map: 0, file: 0, executable: 0, mermaid: 0 }));

vi.mock('next/dynamic', async () => {
  const { default: dynamic } = await vi.importActual<{ default: typeof import('next/dynamic').default }>(
    'next/dist/shared/lib/app-dynamic.js',
  );
  return { default: dynamic };
});
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@echovisionlab/geul-proto/content/block_content_pb.ts', async () => {
  imports.contentSchema += 1;
  return vi.importActual('@echovisionlab/geul-proto/content/block_content_pb.ts');
});
vi.mock('./GeneratedCodeBlockView', () => {
  imports.code += 1;
  return { GeneratedCodeBlockView: () => null };
});
vi.mock('./GeneratedMathBlockView', () => {
  imports.math += 1;
  return { GeneratedMathBlockView: () => null };
});
vi.mock('./GeneratedInlineMathView', () => {
  imports.math += 1;
  return { GeneratedInlineMathView: () => null };
});
vi.mock('./GeneratedMapBlockView', () => {
  imports.map += 1;
  return { GeneratedMapBlockView: () => null };
});
vi.mock('./GeneratedFileBlockView', () => {
  imports.file += 1;
  return { GeneratedFileBlockView: () => null };
});
vi.mock('./GeneratedExecutableBlockView', () => {
  imports.executable += 1;
  return { GeneratedExecutableBlockView: () => null };
});
vi.mock('./GeneratedMermaidBlockView', () => {
  imports.mermaid += 1;
  return { GeneratedMermaidBlockView: () => null };
});

async function render(block: LocalizedRichTextBlock, allowStandaloneExternalVideo = false) {
  const stream = await renderToReadableStream(
    <GeneratedRichTextBlockView
      block={block}
      requestedLocale="ko"
      allowStandaloneExternalVideo={allowStandaloneExternalVideo}
    />,
  );
  await stream.allReady;
  return new Response(stream).text();
}

describe('GeneratedRichTextBlockView runtime boundary', () => {
  it('defers content descriptors from unused wrappers and keeps used enum-based paragraph SSR readable', async () => {
    expect(imports.contentSchema).toBe(0);
    const html = await render({
      id: 'plain-paragraph',
      kind: 'paragraph',
      base: { props: {} },
      locale: { content: [{ value: { case: 'text', value: { text: 'Readable server text' } } }] },
      children: [],
    } as unknown as LocalizedRichTextBlock);
    expect(html).toContain('<p style="text-align:left"><span>Readable server text</span></p>');
    expect(imports.contentSchema).toBe(1);

    const { ParagraphProps_TextAlignment, ParagraphProps_AspectRatio } =
      await import('@echovisionlab/geul-proto/content/block_content_pb.ts');
    const externalVideoHtml = await render(
      {
        id: 'standalone-recording',
        kind: 'paragraph',
        base: {
          props: {
            previewWidth: 42,
            textAlignment: ParagraphProps_TextAlignment.CENTER,
            aspectRatio: ParagraphProps_AspectRatio.X_4_3,
          },
        },
        locale: {
          content: [
            {
              value: {
                case: 'link',
                value: { href: 'https://youtu.be/dQw4w9WgXcQ', content: [{ text: 'Recording' }] },
              },
            },
          ],
        },
        children: [],
      } as unknown as LocalizedRichTextBlock,
      true,
    );
    expect(externalVideoHtml).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0');
    expect(externalVideoHtml).toContain('style="width:42%;margin-left:auto;margin-right:auto"');
    expect(externalVideoHtml).toContain('aspect-ratio:4 / 3');
    expect(externalVideoHtml).toContain('>Recording<');
    expect(imports).toEqual({ contentSchema: 1, code: 0, math: 0, map: 0, file: 0, executable: 0, mermaid: 0 });
  });
});
