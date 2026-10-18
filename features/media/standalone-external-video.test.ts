import { describe, expect, it } from 'vitest';
import type { Block, InlineContent } from '@/lib/types/page-content';
import { resolveStandaloneExternalVideoLink } from './standalone-external-video';

function paragraph(content: Block['content'], children: Block[] = []): Block {
  return { id: 'block', type: 'paragraph', props: {}, content, children };
}

const youtubeLink: InlineContent = {
  type: 'link',
  href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1',
  content: [{ type: 'text', text: 'Recorded session', styles: {} }],
};

describe('resolveStandaloneExternalVideoLink', () => {
  it('accepts one supported link surrounded only by whitespace', () => {
    expect(
      resolveStandaloneExternalVideoLink(
        paragraph([{ type: 'text', text: ' \n', styles: {} }, youtubeLink, { type: 'text', text: '\t', styles: {} }]),
      ),
    ).toEqual({
      url: youtubeLink.href,
      title: 'Recorded session',
      previewWidth: '100',
      textAlignment: 'left',
      aspectRatio: 'auto',
    });
  });

  it('normalizes persisted preview layout props without changing link semantics', () => {
    expect(
      resolveStandaloneExternalVideoLink({
        ...paragraph([youtubeLink]),
        props: { previewWidth: '42', textAlignment: 'center', aspectRatio: '4:3' },
      }),
    ).toMatchObject({ previewWidth: '42', textAlignment: 'center', aspectRatio: '4:3' });
  });

  it.each([
    paragraph([{ type: 'text', text: 'Watch ', styles: {} }, youtubeLink]),
    { ...paragraph([youtubeLink]), type: 'heading' },
    { ...paragraph([youtubeLink]), type: 'bulletListItem' },
    paragraph([youtubeLink], [paragraph([{ type: 'text', text: 'child', styles: {} }])]),
    paragraph([
      youtubeLink,
      {
        ...youtubeLink,
        href: 'https://vimeo.com/76979871',
      },
    ]),
  ])('does not promote a mixed, non-paragraph, nested, or multi-link block', (block) => {
    expect(resolveStandaloneExternalVideoLink(block as Block)).toBeNull();
  });
});
