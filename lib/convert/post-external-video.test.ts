import { describe, expect, it, vi } from 'vitest';
import { convertPostContent } from './post';
import { encodeLegacyWireDocument } from './test-fixtures';

vi.mock('./map-data', () => ({
  injectMapData: vi.fn(async (html: string) => html),
}));

const videoUrl = 'https://youtu.be/dQw4w9WgXcQ';
function externalVideoParagraph(label: string, url = videoUrl) {
  return {
    id: 'post-external-video',
    type: 'paragraph' as const,
    props: {
      previewWidth: '42',
      aspectRatio: '4:3' as const,
      backgroundColor: 'default',
      textColor: 'default',
      textAlignment: 'right' as const,
    },
    content: [
      {
        type: 'link' as const,
        href: url,
        content: [{ type: 'text' as const, text: label, styles: {} }],
      },
    ],
    children: [],
  };
}

async function convertExternalVideoParagraph(label: string, url = videoUrl) {
  return convertPostContent(encodeLegacyWireDocument([externalVideoParagraph(label, url)]), 'post-1');
}

describe('convertPostContent external-video links', () => {
  it('keeps Post preview layout props in public content JSON', async () => {
    const converted = await convertExternalVideoParagraph('Field recording');

    expect((converted.json as unknown[])[0]).toMatchObject({
      type: 'paragraph',
      props: {
        previewWidth: '42',
        aspectRatio: '4:3',
        textAlignment: 'right',
      },
    });
    expect(converted.html).toContain(`<a href="${videoUrl}"`);
    expect(converted.html).toContain('>Field recording</a>');
    expect(converted.html).not.toContain('<iframe');
  });

  it.each([
    ['custom label', 'Field recording', `[Field recording](${videoUrl})`],
    ['URL label', videoUrl, videoUrl],
  ])('keeps %s ordinary Markdown semantics', async (_case, label, expected) => {
    const converted = await convertExternalVideoParagraph(label);

    expect(converted.markdown).toBe(`${expected}\n`);
  });

  it('keeps a standalone Vimeo link as ordinary Markdown', async () => {
    const vimeoUrl = 'https://vimeo.com/76979871';
    const converted = await convertExternalVideoParagraph(vimeoUrl, vimeoUrl);

    expect(converted.markdown).toBe(`${vimeoUrl}\n`);
    expect(converted.html).toContain(`<a href="${vimeoUrl}"`);
    expect(converted.html).not.toContain('<iframe');
  });
});
