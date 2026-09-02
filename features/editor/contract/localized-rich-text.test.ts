import { describe, expect, it } from 'vitest';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  RichTextProfile,
  type LocalizedRichTextDocument,
  type RichTextBlock,
  type RichTextBlockLocale,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { materializeLocalizedRichTextTree } from './localized-rich-text';

const ROOT_ID = '11111111-1111-4111-8111-111111111111';
const CHILD_ID = '22222222-2222-4222-8222-222222222222';

function paragraph(id: string): RichTextBlock {
  return {
    $typeName: 'api.content.v1.RichTextBlock',
    id,
    value: {
      case: 'paragraph',
      value: {
        $typeName: 'api.content.v1.ParagraphBlock',
        props: { $typeName: 'api.content.v1.ParagraphProps' },
      },
    },
  };
}

function paragraphLocale(id: string, text: string): RichTextBlockLocale {
  return {
    $typeName: 'api.content.v1.RichTextBlockLocale',
    blockId: id,
    value: {
      case: 'paragraph',
      value: {
        $typeName: 'api.content.v1.ParagraphBlockLocale',
        props: { $typeName: 'api.content.v1.ParagraphLocaleProps' },
        content: [
          {
            $typeName: 'api.content.v1.RichTextInline',
            value: {
              case: 'text',
              value: {
                $typeName: 'api.content.v1.RichTextStyledText',
                text,
              },
            },
          },
        ],
      },
    },
  };
}

function document(): LocalizedRichTextDocument {
  return {
    $typeName: 'api.content.v1.LocalizedRichTextDocument',
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'ko',
    base: {
      $typeName: 'api.content.v1.RichTextBlockGraph',
      nodes: [
        {
          $typeName: 'api.content.v1.RichTextBlockNode',
          block: paragraph(CHILD_ID),
          placement: {
            $typeName: 'api.content.v1.ContentBlockPlacement',
            parentBlockId: ROOT_ID,
            index: 0,
          },
        },
        {
          $typeName: 'api.content.v1.RichTextBlockNode',
          block: paragraph(ROOT_ID),
          placement: {
            $typeName: 'api.content.v1.ContentBlockPlacement',
            index: 0,
          },
        },
      ],
    },
    localeOverlay: {
      $typeName: 'api.content.v1.RichTextLocaleOverlay',
      locale: 'ko',
      blocks: [paragraphLocale(CHILD_ID, 'Child'), paragraphLocale(ROOT_ID, 'Root')],
    },
  };
}

describe('materializeLocalizedRichTextTree', () => {
  it('pairs generated base and locale payloads and derives nesting from placement', () => {
    const tree = materializeLocalizedRichTextTree(document());

    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ id: ROOT_ID, kind: 'paragraph' });
    expect(tree[0]?.children[0]).toMatchObject({ id: CHILD_ID, kind: 'paragraph' });
    if (tree[0]?.kind !== 'paragraph' || tree[0].children[0]?.kind !== 'paragraph') {
      throw new Error('Expected paragraph fixtures.');
    }
    expect(tree[0].locale.content[0]?.value.value).toMatchObject({ text: 'Root' });
    expect(tree[0].children[0].locale.content[0]?.value.value).toMatchObject({ text: 'Child' });
  });

  it('fails closed when a base Block has no locale payload', () => {
    const value = document();
    value.localeOverlay!.blocks = [paragraphLocale(ROOT_ID, 'Root')];

    expect(() => materializeLocalizedRichTextTree(value)).toThrow(
      `Localized rich-text Block ${CHILD_ID} has no locale payload.`,
    );
  });

  it('delegates UUID and catalog validation to the generated contract', () => {
    const value = document();
    value.base!.nodes[0]!.block!.id = 'legacy-child';

    expect(() => materializeLocalizedRichTextTree(value)).toThrow();
  });
});
