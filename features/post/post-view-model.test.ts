import { PostStatus } from '@echovisionlab/geul-proto/public/post_pb.ts';
import { describe, expect, it } from 'vitest';
import { toPostViewModel } from '@/features/post/post-view-model';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';

describe('toPostViewModel', () => {
  it('composes the hydrated locale body with the independent root layout', () => {
    const documentLayout = { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' } as const;
    const content: readonly LocalizedRichTextBlock[] = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        kind: 'paragraph',
        base: {
          $typeName: 'api.content.v1.ParagraphBlock',
          props: { $typeName: 'api.content.v1.ParagraphProps' },
        },
        locale: {
          $typeName: 'api.content.v1.ParagraphBlockLocale',
          props: { $typeName: 'api.content.v1.ParagraphLocaleProps' },
          content: [],
        },
        children: [],
      },
    ];

    const view = toPostViewModel({
      id: 'post-1',
      title: 'Post',
      slug: 'post',
      summary: undefined,
      content,
      blockMedia: [],
      documentLayout,
      status: 'published',
      statusCode: PostStatus.PUBLISHED,
      commentsEnabled: true,
      localizationInfo: null,
      publishedAt: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      featuredImageUrl: null,
      authors: [],
      categories: [],
      tags: [],
      series: undefined,
      mapPlaceId: null,
      locationPlace: null,
    });

    expect(view.content).toBe(content);
    expect(view.documentLayout).toBe(documentLayout);
    expect(view.content).not.toHaveProperty('layout');
  });
});
