import { describe, expect, it } from 'vitest';
import {
  ParagraphProps_AspectRatio,
  ParagraphProps_TextAlignment,
  type ParagraphProps,
  type RichTextInline,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { resolveGeneratedStandaloneExternalVideoLink } from './standalone-external-video';

describe('resolveGeneratedStandaloneExternalVideoLink', () => {
  const generatedLink: RichTextInline = {
    value: {
      case: 'link',
      value: {
        href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1',
        content: [{ text: 'Generated recording' }],
      },
    },
  } as RichTextInline;

  it('keeps generated Post/Page paragraphs on the exact standalone-link rule', () => {
    expect(
      resolveGeneratedStandaloneExternalVideoLink(
        {
          content: [
            { value: { case: 'text', value: { text: ' \n' } } } as RichTextInline,
            generatedLink,
            { value: { case: 'text', value: { text: '\t' } } } as RichTextInline,
          ],
          props: {
            previewWidth: 42,
            textAlignment: ParagraphProps_TextAlignment.CENTER,
            aspectRatio: ParagraphProps_AspectRatio.X_4_3,
          } as ParagraphProps,
          hasChildren: false,
        },
        { youtubeTitle: 'YouTube', vimeoTitle: 'Vimeo' },
      ),
    ).toEqual({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1',
      title: 'Generated recording',
      previewWidth: '42',
      textAlignment: 'center',
      aspectRatio: '4:3',
    });
  });

  it.each([
    { content: [{ value: { case: 'text', value: { text: 'Watch ' } } } as RichTextInline, generatedLink] },
    { content: [generatedLink, generatedLink] },
    { content: [generatedLink], hasChildren: true },
  ])('does not promote mixed, multi-link, or nested generated paragraphs', ({ content, hasChildren = false }) => {
    expect(resolveGeneratedStandaloneExternalVideoLink({ content, hasChildren })).toBeNull();
  });
});
