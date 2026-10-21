// @vitest-environment jsdom
import {
  siteVariableDocument,
  siteVariableManifest,
} from '@/features/editor/tiptap/site-variables/site-variable.story-fixtures';
import { siteVariableLink, contentSiteVariableHrefCases, siteVariableHrefBlock } from '@/test/site-variable-link';
import { siteVariableContext } from '@/lib/site-variables';
import { create, fromJson, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  ContentBlockMediaItemSchema,
  RichTextDocumentSchema,
  RichTextProfile,
  type RichTextDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { describe, expect, it } from 'vitest';
import { getSchema } from '@tiptap/core';
import { createTiptapWireExtensions } from '@/features/editor/tiptap/wire-schema';
import { markdownBlocks, type MarkdownImagePlaceholder } from '@/features/editor/tiptap/markdown-paste';
import { generatedRichTextDocumentMarkdown } from './generated-rich-text-markdown';

describe('generatedRichTextDocumentMarkdown', () => {
  it.each(contentSiteVariableHrefCases)('exports resolved href: $name', ({ source, expected, settings }) => {
    const localized = siteVariableDocument();
    const paragraph = localized.localeOverlay!.blocks[0]!.value;
    if (paragraph.case !== 'paragraph') {
      throw new Error('Expected paragraph');
    }
    const block = siteVariableHrefBlock(source);
    if (block.kind !== 'paragraph') {
      throw new Error('Expected paragraph');
    }
    paragraph.value.content = block.locale.content;
    const document = create(RichTextDocumentSchema, {
      profile: localized.profile,
      blockCatalogFingerprint: localized.blockCatalogFingerprint,
      sourceLocale: localized.locale,
      base: localized.base,
      localeOverlays: [localized.localeOverlay!],
    });
    expect(
      generatedRichTextDocumentMarkdown(
        document,
        'post',
        siteVariableContext({ ...siteVariableManifest.settings, ...settings }),
      ),
    ).toBe(expected ? `[**Contact**](${expected})\n` : '**Contact**\n');
  });

  it('resolves the canonical link-label tokens, preserving styles and href', () => {
    const localized = siteVariableDocument();
    const paragraph = localized.localeOverlay!.blocks[0]!.value;
    if (paragraph.case !== 'paragraph') {
      throw new Error('Expected a paragraph fixture.');
    }
    paragraph.value.content = [siteVariableLink];
    const document = create(RichTextDocumentSchema, {
      profile: localized.profile,
      blockCatalogFingerprint: localized.blockCatalogFingerprint,
      sourceLocale: localized.locale,
      base: localized.base,
      localeOverlays: [localized.localeOverlay!],
    });
    const context = siteVariableContext(siteVariableManifest.settings);
    expect(generatedRichTextDocumentMarkdown(document, 'post', context)).toBe(
      '[**rawsector \\| https://www.rawsector.com/tools/hwp \\| Example Studio Ltd. \\| legal@example.com \\| contact@example.com \\| {{Site.title}} {{site.unknown}} {{ site.title }} {site.title}**](/tools/hwp)\n',
    );
    expect(
      generatedRichTextDocumentMarkdown(document, 'post', {
        ...context,
        siteTitle: '[unsafe] *title* &copy; {{site.url}}',
        legalEmail: '',
      }),
    ).toContain('\\[unsafe\\] \\*title\\* \\&copy; {{site.url}}');
    expect(generatedRichTextDocumentMarkdown(document, 'post', { ...context, legalEmail: '' })).toContain(
      'Example Studio Ltd. \\|  \\| contact@example.com',
    );
    expect(() => generatedRichTextDocumentMarkdown(document, 'post')).toThrow('Site variable context is required');
  });

  it('exports variable values and contact anchors with a caller-supplied settings snapshot', () => {
    const localized = siteVariableDocument();
    const document = create(RichTextDocumentSchema, {
      profile: localized.profile,
      blockCatalogFingerprint: localized.blockCatalogFingerprint,
      sourceLocale: localized.locale,
      base: localized.base,
      localeOverlays: [localized.localeOverlay!],
    });
    expect(
      generatedRichTextDocumentMarkdown(document, 'post', siteVariableContext(siteVariableManifest.settings)),
    ).toBe('Welcome to rawsector. For help, write to [contact@example.com](mailto:contact@example.com).\n');
    expect(
      generatedRichTextDocumentMarkdown(document, 'post', {
        ...siteVariableContext(siteVariableManifest.settings),
        siteTitle: '[unsafe] *title* &copy; | value',
      }),
    ).toContain('\\[unsafe\\] \\*title\\* \\&copy; \\| value');
    expect(() => generatedRichTextDocumentMarkdown(document, 'post')).toThrow('Site variable context is required');
  });

  it('exports the canonical source locale and nested generated Blocks', () => {
    const parentId = '019cd0f1-b8e3-7b27-9b6a-53d6ddd83d69';
    const childId = '019cd0f1-b8e3-7b27-9b6a-53d6ddd83d70';
    const document = fromJson(RichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile: RichTextProfile.POST,
      sourceLocale: 'ko',
      base: {
        nodes: [
          {
            block: { id: parentId, paragraph: { props: {} } },
            placement: { index: 0 },
          },
          {
            block: { id: childId, codeBlock: { props: { language: 'LANGUAGE_TYPESCRIPT' } } },
            placement: { parentBlockId: parentId, index: 0 },
          },
        ],
      },
      localeOverlays: [
        {
          locale: 'ko',
          blocks: [
            {
              blockId: parentId,
              paragraph: { props: {}, content: [{ text: { text: '본문', styles: { bold: true } } }] },
            },
            {
              blockId: childId,
              codeBlock: { props: {}, content: 'const ok = true;' },
            },
          ],
        },
      ],
    }) as RichTextDocument;

    expect(generatedRichTextDocumentMarkdown(document, 'post-id')).toBe(
      '**본문**\n\n```typescript\nconst ok = true;\n```\n',
    );
  });

  it('exports only active generated File attachments as content-scoped links', () => {
    const activeId = '019cd0f1-b8e3-7b27-9b6a-53d6ddd83d71';
    const missingId = '019cd0f1-b8e3-7b27-9b6a-53d6ddd83d72';
    const document = fromJson(RichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile: RichTextProfile.POST,
      sourceLocale: 'ko',
      base: {
        nodes: [
          {
            block: {
              id: activeId,
              file: {
                props: {
                  attachment: { activeFileId: '33333333-3333-4333-8333-333333333333' },
                  name: 'field recording.wav',
                },
              },
            },
            placement: { index: 0 },
          },
          {
            block: {
              id: missingId,
              file: {
                props: {
                  attachment: {
                    missingAttachment: {
                      formerFileId: '44444444-4444-4444-8444-444444444444',
                      mediaKind: 'MISSING_ATTACHMENT_MEDIA_KIND_FILE',
                    },
                  },
                  name: 'failed-upload.wav',
                },
              },
            },
            placement: { index: 1 },
          },
        ],
      },
      localeOverlays: [
        {
          locale: 'ko',
          blocks: [
            { blockId: activeId, file: { props: {} } },
            { blockId: missingId, file: { props: {} } },
          ],
        },
      ],
    }) as RichTextDocument;

    expect(generatedRichTextDocumentMarkdown(document, 'post-1')).toBe(
      `[field recording.wav](/files/post/post-1/${activeId}/field%20recording.wav)\n`,
    );
  });

  it('exports image Files as absolute images that paste back as image imports', () => {
    const imageId = '019cd0f1-b8e3-7b27-9b6a-53d6ddd83d73';
    const fileId = '019cd0f1-b8e3-7b27-9b6a-53d6ddd83d74';
    const file = (id: string, name: string) => ({
      block: { id, file: { props: { attachment: { activeFileId: randomTestUuid() }, name } } },
      placement: { index: id === imageId ? 0 : 1 },
    });
    const document = fromJson(RichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile: RichTextProfile.POST,
      sourceLocale: 'ko',
      base: { nodes: [file(imageId, 'stage'), file(fileId, 'set list [final].pdf')] },
      localeOverlays: [
        {
          locale: 'ko',
          blocks: [
            { blockId: imageId, file: { props: { alt: 'Stage [left]' } } },
            { blockId: fileId, file: { props: {} } },
          ],
        },
      ],
    }) as RichTextDocument;
    const media = (blockId: string, mimeType: string) =>
      fromJson(ContentBlockMediaItemSchema, {
        selector: { blockId, referencePath: 'file' },
        delivery: { mimeType, asset: { url: `/asset/${blockId}/original` } },
      });

    const markdown = generatedRichTextDocumentMarkdown(document, 'post-1', undefined, {
      blockMedia: [media(imageId, 'image/png'), media(fileId, 'application/pdf')],
      absoluteUrl: (path) => `https://site.example${path}`,
    });

    expect(markdown).toBe(
      `![Stage \\[left\\]](https://site.example/asset/${imageId}/original)\n\n` +
        `[set list \\[final\\].pdf](https://site.example/files/post/post-1/${fileId}/set%20list%20%5Bfinal%5D.pdf)\n`,
    );
    const images: MarkdownImagePlaceholder[] = [];
    markdownBlocks(markdown, getSchema(createTiptapWireExtensions()), { images });
    expect(images.map(({ alt, url }) => [alt, url])).toEqual([
      ['Stage [left]', `https://site.example/asset/${imageId}/original`],
    ]);
  });

  it('exports inline math and standalone external video links as ordinary Markdown', () => {
    const paragraphId = '019cd0f1-b8e3-7b27-9b6a-53d6ddd83d75';
    const videoUrl = 'https://youtu.be/dQw4w9WgXcQ';
    const document = fromJson(RichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile: RichTextProfile.POST,
      sourceLocale: 'ko',
      base: {
        nodes: [
          {
            block: { id: paragraphId, paragraph: { props: {} } },
            placement: { index: 0 },
          },
        ],
      },
      localeOverlays: [
        {
          locale: 'ko',
          blocks: [
            {
              blockId: paragraphId,
              paragraph: {
                props: {},
                content: [
                  { text: { text: 'Equation ' } },
                  { mathInline: { source: 'E=mc^2' } },
                  { text: { text: ' and ' } },
                  { link: { href: videoUrl, content: [{ text: videoUrl }] } },
                ],
              },
            },
          ],
        },
      ],
    }) as RichTextDocument;

    expect(generatedRichTextDocumentMarkdown(document, 'post-1')).toBe(`Equation $E=mc^2$ and ${videoUrl}\n`);
  });

  it('exports typed executable sources and chooses a code fence longer than source runs', () => {
    const codeId = '019cd0f1-b8e3-7b27-9b6a-53d6ddd83d76';
    const p5Id = '019cd0f1-b8e3-7b27-9b6a-53d6ddd83d77';
    const threeId = '019cd0f1-b8e3-7b27-9b6a-53d6ddd83d78';
    const shaderId = '019cd0f1-b8e3-7b27-9b6a-53d6ddd83d79';
    const nestedFenceSource = 'const markdown = "```nested```";';
    const shaderStageKinds = [
      'KIND_COMMON',
      'KIND_VERTEX',
      'KIND_BUFFER_A',
      'KIND_BUFFER_B',
      'KIND_BUFFER_C',
      'KIND_BUFFER_D',
      'KIND_CUBEMAP',
      'KIND_SOUND',
      'KIND_IMAGE',
    ] as const;
    const shaderStageSources: Partial<Record<(typeof shaderStageKinds)[number], string>> = {
      KIND_COMMON: 'float shared = 1.0;',
      KIND_VERTEX: 'void main() { gl_Position = vec4(0.0); }',
      KIND_BUFFER_A: 'void mainImage(out vec4 color, in vec2 coord) { color = vec4(shared); }',
      KIND_SOUND: 'vec2 mainSound(float time) { return vec2(0.0); }',
      KIND_IMAGE: 'void mainImage(out vec4 color, in vec2 coord) { color = vec4(1.0); }',
    };
    const shaderStages = shaderStageKinds.map((kind, index) => ({
      kind,
      source: shaderStageSources[kind] ?? '',
      ...(index >= 2 ? { channels: Array.from({ length: 4 }, () => ({ kind: 'KIND_NONE' })) } : {}),
    }));
    const document = fromJson(RichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile: RichTextProfile.POST,
      sourceLocale: 'ko',
      base: {
        nodes: [
          {
            block: { id: codeId, codeBlock: { props: { language: 'LANGUAGE_TYPESCRIPT' } } },
            placement: { index: 0 },
          },
          {
            block: { id: p5Id, p5Sketch: { props: { source: 'createCanvas(320, 180);' } } },
            placement: { index: 1 },
          },
          {
            block: {
              id: threeId,
              threeScene: {
                props: {
                  language: 'LANGUAGE_TYPESCRIPT',
                  source: 'const scene: THREE.Scene = new THREE.Scene();',
                },
              },
            },
            placement: { index: 2 },
          },
          {
            block: { id: shaderId, shader: { props: { stages: shaderStages } } },
            placement: { index: 3 },
          },
        ],
      },
      localeOverlays: [
        {
          locale: 'ko',
          blocks: [
            { blockId: codeId, codeBlock: { props: {}, content: nestedFenceSource } },
            { blockId: p5Id, p5Sketch: { props: {} } },
            { blockId: threeId, threeScene: { props: {} } },
            { blockId: shaderId, shader: { props: {} } },
          ],
        },
      ],
    }) as RichTextDocument;

    const markdown = generatedRichTextDocumentMarkdown(document, 'post-1');
    expect(markdown).toContain(['````typescript', nestedFenceSource, '````', ''].join('\n'));
    expect(markdown).toContain('```javascript\ncreateCanvas(320, 180);\n```');
    expect(markdown).toContain('```typescript\nconst scene: THREE.Scene = new THREE.Scene();\n```');
    expect(markdown).toContain('### common.glsl\n\n```glsl\nfloat shared = 1.0;\n```');
    expect(markdown).toContain('### vert.glsl\n\n```glsl\nvoid main()');
    expect(markdown).toContain('### buffer-a.glsl\n\n```glsl\nvoid mainImage');
    expect(markdown).toContain('### sound.glsl\n\n```glsl\nvec2 mainSound');
    expect(markdown).toContain('### frag.glsl\n\n```glsl\nvoid mainImage');
  });

  it('exports a Callout and its descendants as one Markdown blockquote', () => {
    const calloutId = '019cd0f1-b8e3-7b27-9b6a-53d6ddd83d73';
    const paragraphId = '019cd0f1-b8e3-7b27-9b6a-53d6ddd83d74';
    const document = fromJson(RichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile: RichTextProfile.POST,
      sourceLocale: 'en',
      base: {
        nodes: [
          {
            block: { id: calloutId, callout: { props: { icon: '⚠️', backgroundColor: 'yellow' } } },
            placement: { index: 0 },
          },
          {
            block: { id: paragraphId, paragraph: { props: {} } },
            placement: { parentBlockId: calloutId, index: 0 },
          },
        ],
      },
      localeOverlays: [
        {
          locale: 'en',
          blocks: [
            {
              blockId: calloutId,
              callout: { props: {}, content: [{ text: { text: 'Clear the rights first.' } }] },
            },
            {
              blockId: paragraphId,
              paragraph: { props: {}, content: [{ text: { text: 'Nested detail.' } }] },
            },
          ],
        },
      ],
    }) as RichTextDocument;

    expect(generatedRichTextDocumentMarkdown(document, 'post-1')).toBe(
      '> ⚠️ Clear the rights first.\n> \n> Nested detail.\n',
    );
  });
});

it.each(['paragraph', 'heading', 'bulletListItem', 'numberedListItem', 'quote'])(
  'exports explicit hard breaks and reimports %s',
  (kind) => {
    const id = '10000000-0000-4000-8000-000000000222';
    const document = fromJson(RichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile: 'RICH_TEXT_PROFILE_POST',
      sourceLocale: 'en',
      base: {
        nodes: [{ block: { id, [kind]: { props: kind === 'heading' ? { level: 1 } : {} } }, placement: { index: 0 } }],
      },
      localeOverlays: [
        {
          locale: 'en',
          blocks: [
            {
              blockId: id,
              [kind]: { props: {}, content: [{ text: { text: 'a' } }, { hardBreak: {} }, { text: { text: 'b' } }] },
            },
          ],
        },
      ],
    });
    const markdown = generatedRichTextDocumentMarkdown(document, 'post');
    expect(markdown).toContain(kind === 'heading' ? 'a<br>b' : 'a  \n');
    const blocks = markdownBlocks(markdown, getSchema(createTiptapWireExtensions()));
    expect(blocks?.[0].content?.[0]).toMatchObject({
      type: kind,
      content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }],
    });
  },
);

it.each(
  [
    [
      { hardBreak: {} },
      { text: { text: 'a' } },
      { hardBreak: {} },
      { hardBreak: {} },
      { text: { text: 'b' } },
      { hardBreak: {} },
    ],
    [{ hardBreak: {} }, { hardBreak: {} }],
  ].map((content) => ({ content })),
)('round trips edge and consecutive hard breaks without paragraph splitting: $content', ({ content }) => {
  const id = '10000000-0000-4000-8000-000000000222';
  const document = fromJson(RichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: 'RICH_TEXT_PROFILE_POST',
    sourceLocale: 'en',
    base: { nodes: [{ block: { id, paragraph: { props: {} } }, placement: { index: 0 } }] },
    localeOverlays: [
      {
        locale: 'en',
        blocks: [
          {
            blockId: id,
            paragraph: {
              props: {},
              content: content.map((item): JsonValue =>
                item.text ? { text: { text: item.text.text } } : { hardBreak: {} },
              ),
            },
          },
        ],
      },
    ],
  });
  const blocks = markdownBlocks(
    generatedRichTextDocumentMarkdown(document, 'post'),
    getSchema(createTiptapWireExtensions()),
  );
  expect(blocks).toHaveLength(1);
  expect(blocks?.[0].content?.[0].content).toEqual(
    content.map((item) => ('hardBreak' in item ? { type: 'hardBreak' } : { type: 'text', text: item.text.text })),
  );
});
