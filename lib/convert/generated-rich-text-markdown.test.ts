import {
  siteVariableDocument,
  siteVariableManifest,
} from '@/features/editor/tiptap/site-variables/site-variable.story-fixtures';
import { siteVariableLink, contentSiteVariableHrefCases, siteVariableHrefBlock } from '@/test/site-variable-link';
import { siteVariableContext } from '@/lib/site-variables';
import { create, fromJson } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  RichTextDocumentSchema,
  RichTextProfile,
  type RichTextDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { describe, expect, it } from 'vitest';
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

  it('resolves the six exact migrated link-label tokens, preserving styles and href', () => {
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
      '[**rawsector \\| https://www.rawsector.com/tools/hwp \\| Example Studio Ltd. \\| legal@example.com \\| support@example.com \\| privacy@example.com \\| {{Site.title}} {{site.unknown}} {{ site.title }} {site.title}**](/tools/hwp)\n',
    );
    expect(
      generatedRichTextDocumentMarkdown(document, 'post', {
        ...context,
        siteTitle: '[unsafe] *title* &copy; {{site.url}}',
        legalEmail: '',
      }),
    ).toContain('\\[unsafe\\] \\*title\\* \\&copy; {{site.url}}');
    expect(generatedRichTextDocumentMarkdown(document, 'post', { ...context, legalEmail: '' })).toContain(
      'Example Studio Ltd. \\|  \\| support@example.com',
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
    ).toBe('Welcome to rawsector. For help, write to [support@example.com](mailto:support@example.com).\n');
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
