import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import {
  ContentBlockDownloadAction,
  ContentBlockDownloadAvailability,
  ContentBlockMediaItemSchema,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { ContentBlockMediaRuntimeProvider } from '@/features/media/ContentBlockMediaRuntimeContext';
import { PageMediaDeliveryProvider } from '@/features/page/PageMediaDeliveryContext';
import enMessages from '@/messages/en.json';
import type { Block, InlineContent } from '@/lib/types/page-content';
import { DefaultBlockView, resolveShaderMediaAsset, resolveUnifiedFileViewKind } from './DefaultBlockView';

describe('DefaultBlockView', () => {
  const noneChannels = () => Array.from({ length: 4 }, () => ({ kind: 'none' }));
  const shaderContent = () =>
    [
      'shaderCommon',
      'shaderVertex',
      'shaderBufferA',
      'shaderBufferB',
      'shaderBufferC',
      'shaderBufferD',
      'shaderCubemap',
      'shaderSound',
      'shaderImage',
    ].map((stage, index) => ({
      type: stage,
      ...(index >= 2 ? { props: { channels: noneChannels() } } : {}),
      content: index === 8 ? [{ type: 'text', text: 'const unsafe = "<script>";', styles: {} }] : [],
    })) as unknown as InlineContent[];

  it.each([
    ['p5Sketch', 'javascript'],
    ['threeScene', 'typescript'],
    ['shader', 'glsl'],
  ] as const)('renders %s as an explicit public runtime surface', (type, language) => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
        <MantineProvider>
          <DefaultBlockView
            block={{
              id: type,
              type,
              props: { title: `Localized ${type}`, mode: 'preview', previewWidth: '48', textAlignment: 'right' },
              content:
                type === 'shader'
                  ? shaderContent()
                  : [{ type: 'text', text: 'const unsafe = "<script>";', styles: {} }],
              children: [],
            }}
          />
        </MantineProvider>
      </NextIntlClientProvider>,
    );

    expect(html).toContain(`data-content-type="${type}"`);
    expect(html).toContain(`data-language="${language}"`);
    expect(html).toContain(`Localized ${type}`);
    expect(html).toContain(`data-runtime-surface="${type}"`);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('width:48%');
    expect(html).toContain('margin-left:auto');
  });

  it('renders ordinary code percentage width and alignment without executable runtime markup', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
        <MantineProvider>
          <DefaultBlockView
            block={{
              id: 'code',
              type: 'codeBlock',
              props: {
                title: 'Localized example',
                language: 'typescript',
                previewWidth: '58',
                textAlignment: 'center',
              },
              content: [{ type: 'text', text: 'const answer: number = 42;', styles: {} }],
              children: [],
            }}
          />
        </MantineProvider>
      </NextIntlClientProvider>,
    );

    expect(html).toContain('data-language="typescript"');
    expect(html).toContain('data-preview-width="58"');
    expect(html).toContain('data-text-alignment="center"');
    expect(html).toContain('Localized example');
    expect(html).toContain('TypeScript');
    expect(html).toContain('aria-label="Copy"');
    expect(html).toContain('data-code-block-surface');
    expect(html).toContain('width:58%');
    expect(html).toContain('margin-left:auto');
    expect(html).toContain('margin-right:auto');
    expect(html).not.toContain('data-runtime-surface');
  });

  it('projects durable p5 device capabilities into the public runtime controls', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
        <MantineProvider>
          <DefaultBlockView
            block={{
              id: 'p5-device',
              type: 'p5Sketch',
              props: { capabilities: 'camera microphone' },
              content: [{ type: 'text', text: 'createCapture(VIDEO);', styles: {} }],
              children: [],
            }}
          />
        </MantineProvider>
      </NextIntlClientProvider>,
    );

    expect(html).toContain('data-p5-capability-trigger');
    expect(html).toContain('aria-label="Inputs and devices: Camera, Microphone"');
    expect(html).toContain('data-count="2"');
    expect(html).toContain('aria-label="Run"');
    expect(html).not.toContain('aria-label="Stop"');
  });

  it('renders quote content through the public block renderer', () => {
    const html = renderToStaticMarkup(
      <DefaultBlockView
        block={{
          id: 'quote',
          type: 'quote',
          props: { textAlignment: 'center' },
          content: [{ type: 'text', text: '공간은 소리를 기억한다.', styles: {} }],
          children: [],
        }}
      />,
    );

    expect(html).toContain('<blockquote style="text-align:center">');
    expect(html).toContain('<span>공간은 소리를 기억한다.</span>');
  });

  it('renders a materialized Callout around its nested Blocks', () => {
    const html = renderToStaticMarkup(
      <DefaultBlockView
        block={{
          id: 'callout',
          type: 'callout',
          props: { icon: '💡', backgroundColor: 'blue', textColor: 'default' },
          content: [{ type: 'text', text: 'Callout body', styles: {} }],
          children: [
            {
              id: 'callout-copy',
              type: 'paragraph',
              props: {},
              content: [{ type: 'text', text: 'Nested Callout copy', styles: {} }],
              children: [],
            },
          ],
        }}
      />,
    );

    expect(html).toContain('<aside data-callout="" data-bg-color="blue" data-text-color="default">');
    expect(html).toContain('<span data-callout-icon="" aria-hidden="true">💡</span>');
    expect(html).toContain('<div data-callout-content=""><div data-callout-copy=""><span>Callout body</span></div><p');
    expect(html).toContain('Nested Callout copy');
  });

  it('renders materialized table content and durable column widths', () => {
    const html = renderToStaticMarkup(
      <DefaultBlockView
        block={
          {
            id: 'table',
            type: 'table',
            props: { previewWidth: '82', textAlignment: 'center' },
            content: {
              type: 'tableContent',
              columnWidths: [40, 60],
              rows: [
                {
                  cells: [
                    { type: 'tableCell', props: {}, content: [{ type: 'text', text: '장소', styles: {} }] },
                    { type: 'tableCell', props: {}, content: [{ type: 'text', text: '기록', styles: {} }] },
                  ],
                },
                {
                  cells: [
                    { type: 'tableCell', props: {}, content: [{ type: 'text', text: '예술의전당', styles: {} }] },
                    { type: 'tableCell', props: {}, content: [{ type: 'text', text: '저녁 리허설', styles: {} }] },
                  ],
                },
              ],
            },
            children: [],
          } as unknown as Block
        }
      />,
    );

    expect(html).toContain('<col style="width:40%"/>');
    expect(html).toContain('<col style="width:60%"/>');
    expect(html).toContain('<table style="width:82%;margin-left:auto;margin-right:auto">');
    expect(html).toContain('<thead><tr><th><span>장소</span></th>');
    expect(html).toContain('<tbody><tr><td><span>예술의전당</span></td>');
    expect(html).toContain('<td><span>저녁 리허설</span></td>');
  });

  it('resolves Shader File channels through the owning content public asset lookup', async () => {
    const delivery = {
      refresh: async () => ({}),
      resolveAsset: async (fileId: string, kind: 'image' | 'video') =>
        kind === 'image' ? `/media/${fileId}/image` : `/media/${fileId}/master.m3u8`,
    } as unknown as NonNullable<Parameters<typeof resolveShaderMediaAsset>[0]>;

    await expect(resolveShaderMediaAsset(delivery, 'texture-file', 'image')).resolves.toEqual({
      fileId: 'texture-file',
      kind: 'image',
      url: '/media/texture-file/image',
    });
    await expect(resolveShaderMediaAsset(delivery, 'video-file', 'video')).resolves.toEqual({
      fileId: 'video-file',
      kind: 'video',
      url: '/media/video-file/master.m3u8',
    });
    await expect(resolveShaderMediaAsset(null, 'deleted-file', 'image')).rejects.toThrow(
      'Shader media delivery is unavailable.',
    );
  });

  it('fails closed for unknown durable Block kinds', () => {
    expect(() =>
      renderToStaticMarkup(
        <DefaultBlockView block={{ id: 'future', type: 'futureBlock', props: {}, content: [], children: [] }} />,
      ),
    ).toThrow('Unsupported rich-text Block kind: futureBlock');
  });

  it('fails closed when a public Shader stage tree is incomplete', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
        <MantineProvider>
          <DefaultBlockView
            block={{
              id: 'broken-shader',
              type: 'shader',
              props: {},
              content: shaderContent().slice(0, 8),
              children: [],
            }}
          />
        </MantineProvider>
      </NextIntlClientProvider>,
    );
    expect(html).toContain('<div data-invalid-executable-block="shader"></div>');
    expect(html).not.toContain('data-runtime-surface="shader"');
  });

  it.each([
    ['image/webp', 'image'],
    ['audio/wav', 'audio'],
    ['video/mp4', 'video'],
    ['application/pdf', 'file'],
  ] as const)('branches a unified file block with %s to the %s view', (mimeType, expected) => {
    expect(resolveUnifiedFileViewKind({ id: 'file', type: 'file', props: { mimeType } })).toBe(expected);
  });

  it('renders an image MIME file block through the image viewer', () => {
    const html = renderToStaticMarkup(
      <DefaultBlockView
        block={{
          id: 'file-image',
          type: 'file',
          props: {
            fileId: 'image-1',
            mimeType: 'image/webp',
            url: 'https://cdn.example.com/file-image.webp',
            alt: 'Unified image',
          },
        }}
      />,
    );

    expect(html).toContain('<img');
    expect(html).toContain('src="https://cdn.example.com/file-image.webp"');
    expect(html).toContain('alt="Unified image"');
  });

  it.each([
    ['image/webp', { name: 'Draft image', url: 'https://cdn.example.com/draft.webp' }],
    ['audio/wav', { name: 'Draft audio', url: 'https://cdn.example.com/draft.wav' }],
    ['video/mp4', { name: 'Draft video', hlsUrl: 'https://cdn.example.com/draft.m3u8' }],
    ['application/pdf', { name: 'Draft notes', url: 'https://cdn.example.com/draft.pdf' }],
  ])('does not publish a %s placeholder without an authoritative File identity', (mimeType, props) => {
    const html = renderToStaticMarkup(
      <DefaultBlockView block={{ id: 'placeholder', type: 'file', props: { fileId: '  ', mimeType, ...props } }} />,
    );

    expect(html).toBe('');
  });

  it('renders inline link nodes that store href at the top level', () => {
    const block: Block = {
      id: 'rich-link',
      type: 'paragraph',
      props: {},
      content: [
        {
          type: 'text',
          text: 'Before ',
          styles: {},
        },
        {
          type: 'link',
          href: 'https://example.com/page-reference',
          content: [
            {
              type: 'text',
              text: 'page reference',
              styles: {},
            },
          ],
        } as InlineContent,
        {
          type: 'text',
          text: ' after',
          styles: {},
        },
      ],
    };

    const html = renderToStaticMarkup(<DefaultBlockView block={block} />);

    expect(html).toContain('href="https://example.com/page-reference"');
    expect(html).toContain('>page reference<');
  });

  it('renders unsafe links as non-clickable text after href normalization', () => {
    const unsafeHref = `${'java'}script:alert(1)`;
    const block: Block = {
      id: 'unsafe-link',
      type: 'paragraph',
      props: {},
      content: [
        {
          type: 'link',
          href: unsafeHref,
          content: [{ type: 'text', text: 'Unsafe destination', styles: {} }],
        },
      ],
    };

    const html = renderToStaticMarkup(<DefaultBlockView block={block} />);

    expect(html).not.toContain('<a');
    expect(html).toContain('Unsafe destination');
  });

  it('renders soft line breaks inside inline paragraph text', () => {
    const block: Block = {
      id: 'soft-breaks',
      type: 'paragraph',
      props: {},
      content: [
        {
          type: 'text',
          text: 'First line\nSecond line\n\nFourth line',
          styles: {},
        },
      ],
    };

    const html = renderToStaticMarkup(<DefaultBlockView block={block} />);

    expect(html).toContain('First line<br/>Second line<br/><br/>Fourth line');
  });

  it('renders materialized divider blocks as horizontal rules', () => {
    const block: Block = {
      id: 'divider',
      type: 'divider',
      props: {},
      content: [],
      children: [],
    };

    const html = renderToStaticMarkup(<DefaultBlockView block={block} />);

    expect(html).toBe('<hr/>');
  });

  it('renders attachment captions below the title row', () => {
    const block: Block = {
      id: 'attachment',
      type: 'file',
      props: {
        fileId: 'file-pdf',
        url: 'https://cdn.example.com/file.pdf',
        caption: 'Recorded in the lower valley',
        name: 'Field notes',
        mimeType: 'application/pdf',
        size: '2048',
        previewWidth: '62',
        textAlignment: 'left',
      },
      content: [],
      children: [],
    };

    const html = renderToStaticMarkup(
      <NextIntlClientProvider
        locale="en"
        timeZone="UTC"
        messages={{
          editorCommon: {
            media: {
              attachmentEditor: {
                untitledFile: 'Untitled file',
              },
            },
          },
        }}
      >
        <DefaultBlockView block={block} />
      </NextIntlClientProvider>,
    );

    expect(html).toContain('attachment-title');
    expect(html).toContain('attachment-block__surface');
    expect(html).not.toContain('data-control-size');
    expect(html).not.toContain('href="https://cdn.example.com/file.pdf"');
    expect(html).toContain('Field notes');
    expect(html).toContain('media-block__caption');
    expect(html).toContain('Recorded in the lower valley');
    expect(html.indexOf('attachment-block__header')).toBeLessThan(html.indexOf('media-block__caption'));
    expect(html).toContain('width:62%');
  });

  it('renders the image original-download action from the exact Block runtime decision', () => {
    const blockId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e795';
    const fileId = 'b67328c4-668c-5bf2-8f1e-41465149ded6';
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
    const block: Block = {
      id: blockId,
      type: 'file',
      props: {
        fileId,
        mimeType: 'image/png',
        url: 'https://cdn.example/field-recording.png',
        name: 'Field recording still',
        downloadAvailability: 2,
        downloadAction: 3,
      },
    };

    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
        <MantineProvider>
          <PageMediaDeliveryProvider idOrSlug="page-1" requestedLocale="en">
            <ContentBlockMediaRuntimeProvider items={[item]}>
              <DefaultBlockView block={block} />
            </ContentBlockMediaRuntimeProvider>
          </PageMediaDeliveryProvider>
        </MantineProvider>
      </NextIntlClientProvider>,
    );

    expect(html).toContain('<img');
    expect(html).toContain('data-authorized-download-action="icon"');
    expect(html).toContain('aria-label="Download Field recording still"');
  });

  it('renders image captions with the shared media shell classes', () => {
    const block: Block = {
      id: 'image',
      type: 'file',
      props: {
        fileId: 'file-image',
        mimeType: 'image/webp',
        url: 'https://cdn.example.com/image.webp',
        caption: 'Documented during setup',
        name: 'setup.webp',
        previewWidth: '54',
        textAlignment: 'center',
      },
      content: [],
      children: [],
    };

    const html = renderToStaticMarkup(<DefaultBlockView block={block} />);

    expect(html).toContain('class="image-block"');
    expect(html).toContain('media-block__caption');
    expect(html).toContain('Documented during setup');
    expect(html).toContain('width:54%');
    expect(html).toContain('margin-left:auto');
  });

  it('keeps restored missing media blocks while rendering only kind-specific fallbacks', () => {
    const blocks: Block[] = [
      { id: 'missing-image', type: 'file', props: { fileId: 'image-1', mimeType: 'image/webp', mediaMissing: true } },
      { id: 'missing-video', type: 'file', props: { fileId: 'video-1', mimeType: 'video/mp4', mediaMissing: true } },
      { id: 'missing-audio', type: 'file', props: { fileId: 'audio-1', mimeType: 'audio/mpeg', mediaMissing: true } },
      {
        id: 'missing-file',
        type: 'file',
        props: { fileId: 'file-1', mimeType: 'application/pdf', mediaMissing: true, caption: 'Preserved caption' },
      },
    ];

    const html = renderToStaticMarkup(
      <NextIntlClientProvider
        locale="en"
        timeZone="UTC"
        messages={{
          mediaCommon: {
            missing: {
              imageDeleted: 'This image was deleted.',
              videoDeleted: 'This video was deleted.',
              audioDeleted: 'This audio was deleted.',
              fileDeleted: 'This file was deleted.',
            },
          },
        }}
      >
        <MantineProvider>
          {blocks.map((block) => (
            <DefaultBlockView key={block.id} block={block} />
          ))}
        </MantineProvider>
      </NextIntlClientProvider>,
    );

    for (const kind of ['image', 'video', 'audio', 'file']) {
      expect(html).toContain(`data-media-missing-kind="${kind}"`);
    }
    expect(html).toContain('This image was deleted.');
    expect(html).toContain('This video was deleted.');
    expect(html).toContain('This audio was deleted.');
    expect(html).toContain('This file was deleted.');
    expect(html).toContain('Preserved caption');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<video');
    expect(html).not.toContain('<audio');
    expect(html).not.toContain('<button');
  });
});
