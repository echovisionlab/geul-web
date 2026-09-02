// @vitest-environment jsdom

import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { create } from '@bufbuild/protobuf';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import {
  BulletListItemBlockLocaleSchema,
  BulletListItemBlockSchema,
  ContentBlockDownloadAction,
  ContentBlockDownloadAvailability,
  ContentBlockMediaItemSchema,
  FileBlockLocaleSchema,
  FileBlockSchema,
  ParagraphProps_AspectRatio,
  ParagraphProps_TextAlignment,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  AuthorizeDownloadResponseSchema,
  FileDownloadAccessSchema,
  FileDownloadAction,
  FileDownloadAvailability,
  PublicMediaEntityType,
} from '@echovisionlab/geul-proto/public/file_pb.ts';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { ContentBlockMediaRuntimeProvider } from '@/features/media/ContentBlockMediaRuntimeContext';
import { authorizeFileDownload } from '@/lib/queries/file-download-browser';
import enMessages from '@/messages/en.json';
import { TestProviders } from '@/test/TestProviders';
import { GeneratedRichTextBlockView } from './GeneratedRichTextBlockView';

vi.mock('@/lib/queries/file-download-browser', () => ({ authorizeFileDownload: vi.fn() }));

function generatedParagraph(
  content: unknown[],
  children: readonly LocalizedRichTextBlock[] = [],
): LocalizedRichTextBlock {
  return {
    id: 'generated-external-video',
    kind: 'paragraph',
    base: {
      props: {
        previewWidth: 42,
        textAlignment: ParagraphProps_TextAlignment.CENTER,
        aspectRatio: ParagraphProps_AspectRatio.X_4_3,
      },
    },
    locale: { content },
    children,
  } as LocalizedRichTextBlock;
}

function generatedBulletListItem(children: readonly LocalizedRichTextBlock[]): LocalizedRichTextBlock {
  return {
    id: 'generated-external-video-list-item',
    kind: 'bullet-list-item',
    base: create(BulletListItemBlockSchema),
    locale: create(BulletListItemBlockLocaleSchema),
    children,
  };
}

function renderGenerated(block: LocalizedRichTextBlock): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
      <GeneratedRichTextBlockView block={block} allowStandaloneExternalVideo />
    </NextIntlClientProvider>,
  );
}

describe('GeneratedRichTextBlockView external video', () => {
  it('renders Callout icon, theme color, and nested rich-text children as one surface', () => {
    const html = renderGenerated({
      id: 'callout',
      kind: 'callout',
      base: { props: { icon: '⚠️', backgroundColor: 'yellow', textColor: 'default' } },
      locale: {
        props: {},
        content: [{ value: { case: 'text', value: { text: 'Callout body' } } }],
      },
      children: [generatedParagraph([{ value: { case: 'text', value: { text: 'Clear the rights first.' } } }])],
    } as unknown as LocalizedRichTextBlock);

    expect(html).toContain('<aside data-callout="" data-bg-color="yellow" data-text-color="default">');
    expect(html).toContain('<span data-callout-icon="" aria-hidden="true">⚠️</span>');
    expect(html).toContain('<div data-callout-content=""><div data-callout-copy=""><span>Callout body</span></div><p');
    expect(html).toContain('Clear the rights first.');
  });

  it('renders the generated Post/Page standalone YouTube link as the canonical non-autoplay player', () => {
    const html = renderGenerated(
      generatedParagraph([
        {
          value: {
            case: 'link',
            value: {
              href: 'https://youtu.be/dQw4w9WgXcQ?autoplay=1',
              content: [{ text: 'Generated recording' }],
            },
          },
        },
      ]),
    );

    expect(html).toContain('<iframe');
    expect(html).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0');
    expect(html).toContain('style="width:42%;margin-left:auto;margin-right:auto"');
    expect(html).toContain('aspect-ratio:4 / 3');
    expect(html).toContain('href="https://youtu.be/dQw4w9WgXcQ?autoplay=1"');
  });

  it('keeps a generated mixed paragraph as ordinary content', () => {
    const html = renderGenerated(
      generatedParagraph([
        { value: { case: 'text', value: { text: 'Watch ' } } },
        {
          value: {
            case: 'link',
            value: { href: 'https://youtu.be/dQw4w9WgXcQ', content: [{ text: 'recording' }] },
          },
        },
      ]),
    );

    expect(html).not.toContain('<iframe');
    expect(html).toContain('<p');
    expect(html).toContain('>recording<');
  });

  it('renders generated Vimeo links with the same non-autoplay player and fallback', () => {
    const html = renderGenerated(
      generatedParagraph([
        {
          value: {
            case: 'link',
            value: {
              href: 'https://vimeo.com/123456789?autoplay=1',
              content: [{ text: 'Generated Vimeo recording' }],
            },
          },
        },
      ]),
    );

    expect(html).toContain('https://player.vimeo.com/video/123456789?dnt=1&amp;autoplay=0');
    expect(html).toContain('href="https://vimeo.com/123456789?autoplay=1"');
  });

  it('keeps the shared generated renderer ordinary outside the explicit Post/Page boundary', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
        <GeneratedRichTextBlockView
          block={generatedParagraph([
            {
              value: {
                case: 'link',
                value: { href: 'https://youtu.be/dQw4w9WgXcQ', content: [{ text: 'recording' }] },
              },
            },
          ])}
        />
      </NextIntlClientProvider>,
    );

    expect(html).not.toContain('<iframe');
    expect(html).toContain('<p');
  });

  it('keeps a generated list child as an ordinary link even within the Post/Page boundary', () => {
    const html = renderGenerated(
      generatedBulletListItem([
        generatedParagraph([
          {
            value: {
              case: 'link',
              value: { href: 'https://youtu.be/dQw4w9WgXcQ', content: [{ text: 'recording' }] },
            },
          },
        ]),
      ]),
    );

    expect(html).not.toContain('<iframe');
    expect(html).toContain('<a href="https://youtu.be/dQw4w9WgXcQ"');
  });
});

describe('GeneratedRichTextBlockView File Block downloads', () => {
  it('authorizes an image original download with the exact Block relation selector', async () => {
    const blockId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e795';
    const fileId = 'b67328c4-668c-5bf2-8f1e-41465149ded6';
    const authorize = vi.mocked(authorizeFileDownload).mockResolvedValue(
      create(AuthorizeDownloadResponseSchema, {
        access: create(FileDownloadAccessSchema, {
          availability: FileDownloadAvailability.UNAVAILABLE,
          action: FileDownloadAction.NONE,
        }),
      }),
    );
    const block = {
      id: blockId,
      kind: 'file',
      base: create(FileBlockSchema, {
        props: {
          attachment: { state: { case: 'activeFileId', value: fileId } },
          name: 'Original image',
        },
      }),
      locale: create(FileBlockLocaleSchema, { props: { alt: 'Field recording still', caption: '' } }),
      children: [],
    } as Extract<LocalizedRichTextBlock, { kind: 'file' }>;
    const item = create(ContentBlockMediaItemSchema, {
      selector: { blockId, referencePath: 'file' },
      attachment: { state: { case: 'activeFileId', value: fileId } },
      delivery: {
        fileId,
        fileName: 'field-recording',
        extension: 'png',
        mimeType: 'image/png',
        fileSize: 1024n,
        asset: { url: 'https://cdn.example/field-recording.png' },
      },
      downloadAvailability: ContentBlockDownloadAvailability.AVAILABLE,
      downloadAction: ContentBlockDownloadAction.DOWNLOAD,
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <TestProviders>
          <ContentBlockMediaRuntimeProvider items={[item]}>
            <GeneratedRichTextBlockView
              block={block}
              downloadOwner={{ entityType: PublicMediaEntityType.WORK, entityId: 'work-1' }}
            />
          </ContentBlockMediaRuntimeProvider>
        </TestProviders>,
      );
    });

    const button = host.querySelector<HTMLButtonElement>('[data-authorized-download-action="icon"]');
    expect(button).not.toBeNull();
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(authorize).toHaveBeenCalledWith({
      entityType: PublicMediaEntityType.WORK,
      entityId: 'work-1',
      selector: { blockId, referencePath: 'file' },
    });

    await act(async () => root.unmount());
    host.remove();
  });
});
