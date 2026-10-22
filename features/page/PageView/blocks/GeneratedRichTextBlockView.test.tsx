// @vitest-environment jsdom

import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { create } from '@bufbuild/protobuf';
import { NextIntlClientProvider } from 'next-intl';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  BulletListItemBlockLocaleSchema,
  BulletListItemBlockSchema,
  ContentBlockDownloadAction,
  ContentBlockDownloadAvailability,
  ContentBlockMediaItemSchema,
  FileBlockLocaleSchema,
  FileBlockSchema,
  ParagraphProps_AspectRatio,
  ParagraphProps_LinkPresentation,
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
import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { siteVariableManifest } from '@/features/editor/tiptap/site-variables/site-variable.story-fixtures';
import { TestProviders } from '@/test/TestProviders';
import { GeneratedRichTextBlockView } from './GeneratedRichTextBlockViewRuntime';

const preload = vi.hoisted(() => ({ pending: [] as Promise<unknown>[] }));

vi.mock('next/dynamic', async () => {
  const { default: dynamic } = await vi.importActual<{ default: typeof import('next/dynamic').default }>(
    'next/dynamic',
  );
  return {
    default: (...args: Parameters<typeof dynamic>) => {
      const View = dynamic(...args) as ReturnType<typeof dynamic> & { render: { preload: () => Promise<unknown> } };
      preload.pending.push(View.render.preload());
      return View;
    },
  };
});

beforeAll(async () => {
  await Promise.all(preload.pending);
});

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
        displaySize: 42,
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
  it('escapes resolved link text once, keeps empty labels safe, and leaves ordinary text literal', () => {
    const block = generatedParagraph([
      { value: { case: 'text', value: { text: '{{site.title}}' } } },
      { value: { case: 'link', value: { href: '/tools/hwp', content: [{ text: '{{site.title}}' }] } } },
      { value: { case: 'link', value: { href: '/empty', content: [{ text: '{{contact.legalEmail}}' }] } } },
    ]);
    const html = renderToStaticMarkup(
      <ManifestProvider
        manifest={{
          ...siteVariableManifest,
          settings: {
            ...siteVariableManifest.settings,
            site_title: '<b>& {{site.url}}',
            legal_email: '',
          },
        }}
      >
        <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
          <GeneratedRichTextBlockView block={block} />
        </NextIntlClientProvider>
      </ManifestProvider>,
    );
    expect(html).toContain('<span>{{site.title}}</span>');
    expect(html).toContain('<span>&lt;b&gt;&amp; {{site.url}}</span>');
    expect(html).toContain('href="/empty" target="_blank" rel="noopener noreferrer"><span></span></a>');
  });

  it('renders Callout icon, theme color, and nested rich-text children as one surface', () => {
    // Parse into this document so the elements have a window (DOMParser and template documents have none).
    const page = document.createElement('div');
    page.innerHTML = renderGenerated({
      id: 'callout',
      kind: 'callout',
      base: { props: { icon: '⚠️', backgroundColor: 'yellow', textColor: 'default' } },
      locale: {
        props: {},
        content: [{ value: { case: 'text', value: { text: 'Callout body' } } }],
      },
      children: [generatedParagraph([{ value: { case: 'text', value: { text: 'Clear the rights first.' } } }])],
    } as unknown as LocalizedRichTextBlock);

    const callouts = page.querySelectorAll('aside');
    expect(callouts).toHaveLength(1);
    const callout = callouts[0];
    expect(callout).toHaveAttribute('data-bg-color', 'yellow');
    const icon = [...callout.getElementsByTagName('*')].find((element) => element.textContent === '⚠️');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(callout.textContent).toContain('Callout body');
    expect(callout.textContent).toContain('Clear the rights first.');
  });

  it('server-renders a standalone YouTube link as a play control that waits for consent', () => {
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

    expect(html).not.toContain('<iframe');
    expect(html).toContain('data-external-video-facade=""');
    expect(html).toContain('aria-label="Play Generated recording"');
    expect(html).toContain('Playing loads it from YouTube.');
    expect(html).toContain('style="width:min(42%, calc(33.6svh * 1.3333));margin-left:auto;margin-right:auto"');
    expect(html).toContain('aspect-ratio:4 / 3');
    expect(html).toContain('href="https://youtu.be/dQw4w9WgXcQ?autoplay=1"');
  });

  it('renders a standalone link the author chose to show as a card with its stored media and caption', () => {
    const blockId = '10000000-0000-4000-8000-000000000021';
    const media = (referencePath: string, fileId: string, url: string) =>
      create(ContentBlockMediaItemSchema, {
        selector: { blockId, referencePath },
        attachment: { state: { case: 'activeFileId', value: fileId } },
        delivery: { fileId, mimeType: 'image/png', asset: { url } },
      });
    const block = {
      ...generatedParagraph([
        {
          value: {
            case: 'link',
            value: { href: 'https://youtu.be/dQw4w9WgXcQ', content: [{ text: 'Live at the Hall' }] },
          },
        },
      ]),
      id: blockId,
      base: { props: { linkPresentation: ParagraphProps_LinkPresentation.CARD } },
    } as LocalizedRichTextBlock;
    (block.locale as { props?: unknown }).props = { linkDescription: 'A full set.', linkCaption: 'Recorded in 2026.' };

    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
        <ContentBlockMediaRuntimeProvider
          items={[
            media('paragraph.linkThumbnail', '10000000-0000-4000-8000-000000000022', '/asset/cover.jpg'),
            media('paragraph.linkIcon', '10000000-0000-4000-8000-000000000023', '/asset/icon.png'),
          ]}
        >
          <GeneratedRichTextBlockView block={block} allowStandaloneExternalVideo />
        </ContentBlockMediaRuntimeProvider>
      </NextIntlClientProvider>,
    );

    expect(html).not.toContain('data-external-video');
    expect(html).toContain('href="https://youtu.be/dQw4w9WgXcQ"');
    expect(html).toContain('>Live at the Hall<');
    expect(html).toContain('>A full set.<');
    expect(html).toContain('>https://youtu.be/dQw4w9WgXcQ<');
    expect(html).toContain('cover.jpg');
    expect(html).toContain('icon.png');
    expect(html).toContain('>Recorded in 2026.<');
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

  it('server-renders generated Vimeo links with the same play control and fallback', () => {
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

    expect(html).not.toContain('<iframe');
    expect(html).toContain('Playing loads it from Vimeo.');
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

    await act(async () => {
      await vi.waitFor(() => {
        expect(host.querySelector<HTMLButtonElement>('[data-authorized-download-action="icon"]')).not.toBeNull();
      });
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

  it.each([
    { mimeType: 'image/png', extension: 'png', rendered: '<img' },
    { mimeType: 'application/pdf', extension: 'pdf', rendered: 'attachment-title' },
  ])('draws no download icon on a $mimeType File the reader cannot download', ({ mimeType, extension, rendered }) => {
    const blockId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e795';
    const fileId = 'b67328c4-668c-5bf2-8f1e-41465149ded6';
    const block = {
      id: blockId,
      kind: 'file',
      base: create(FileBlockSchema, {
        props: { attachment: { state: { case: 'activeFileId', value: fileId } }, name: 'Original image' },
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
        extension,
        mimeType,
        fileSize: 1024n,
        asset: { url: `https://cdn.example/field-recording.${extension}` },
      },
      downloadAvailability: ContentBlockDownloadAvailability.UNAVAILABLE,
      downloadAction: ContentBlockDownloadAction.NONE,
    });

    const html = renderToStaticMarkup(
      <TestProviders>
        <ContentBlockMediaRuntimeProvider items={[item]}>
          <GeneratedRichTextBlockView
            block={block}
            downloadOwner={{ entityType: PublicMediaEntityType.WORK, entityId: 'work-1' }}
          />
        </ContentBlockMediaRuntimeProvider>
      </TestProviders>,
    );

    expect(html).toContain(rendered);
    expect(html).not.toContain('data-authorized-download-action');
  });
});

describe('GeneratedRichTextBlockView list nesting', () => {
  it('keeps children inside the item while the authored background and alignment cover only its own text', () => {
    const html = renderGenerated({
      ...generatedBulletListItem([generatedParagraph([{ value: { case: 'text', value: { text: 'Child' } } }])]),
      base: { props: { textColor: 'red', backgroundColor: 'yellow' } },
      locale: { content: [{ value: { case: 'text', value: { text: 'Parent' } } }] },
    } as unknown as LocalizedRichTextBlock);
    const host = document.createElement('div');
    host.innerHTML = html;
    const item = host.querySelector('li')!;
    expect(item.getAttribute('data-text-color')).toBe('red');
    expect(item.hasAttribute('data-bg-color')).toBe(false);
    const content = item.querySelector(':scope > [data-list-item-content]')!;
    expect(content.getAttribute('data-bg-color')).toBe('yellow');
    expect(content.textContent).toBe('Parent');
    expect(item.querySelector(':scope > [data-document-children]')?.textContent).toContain('Child');
  });
});

it('renders canonical and legacy line breaks identically in public posts/pages, including styled link text', () => {
  const text = (text: string) => ({ value: { case: 'text', value: { text, styles: { bold: true } } } });
  const br = { value: { case: 'hardBreak', value: {} } };
  const canonical = generatedParagraph([br, text('a'), br, br, text('b'), br]);
  const legacy = generatedParagraph([text('\ra\r\n\nb\n')]);
  // Styles wrap each legacy run, while its break positions remain identical.
  const legacyHTML = renderToStaticMarkup(
    <TestProviders>
      <GeneratedRichTextBlockView block={legacy} />
    </TestProviders>,
  );
  const canonicalHTML = renderToStaticMarkup(
    <TestProviders>
      <GeneratedRichTextBlockView block={canonical} />
    </TestProviders>,
  );
  expect(legacyHTML.match(/<br\s*\/?\s*>/g)).toHaveLength(4);
  const structure = (html: string) => html.replace(/<(?!br\b)[^>]+>/g, '');
  expect(structure(legacyHTML)).toBe(structure(canonicalHTML));
  const linked = generatedParagraph([
    { value: { case: 'link', value: { href: '/example', content: [{ text: 'a\nb', styles: { italic: true } }] } } },
  ]);
  const html = renderToStaticMarkup(
    <TestProviders>
      <GeneratedRichTextBlockView block={linked} />
    </TestProviders>,
  );
  expect(html).toContain('<em>a<br/>b</em>');
});
