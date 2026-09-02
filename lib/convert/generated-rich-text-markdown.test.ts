import { fromJson } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  RichTextDocumentSchema,
  RichTextProfile,
  type RichTextDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { describe, expect, it } from 'vitest';
import { generatedRichTextDocumentMarkdown } from './generated-rich-text-markdown';

describe('generatedRichTextDocumentMarkdown', () => {
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
