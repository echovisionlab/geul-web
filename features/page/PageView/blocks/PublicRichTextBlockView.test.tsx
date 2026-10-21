import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import Loadable from 'next/dist/shared/lib/loadable.shared-runtime';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Block, InlineContent } from '@/lib/types/page-content';
import enMessages from '@/messages/en.json';
import { PublicRichTextBlockView } from './PublicRichTextBlockView';

function paragraph(content: Block['content'], children: Block[] = []): Block {
  return { id: 'block', type: 'paragraph', props: {}, content, children };
}

const youtubeLink: InlineContent = {
  type: 'link',
  href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1',
  content: [{ type: 'text', text: 'Recorded session', styles: {} }],
};

function renderPublicRichText(block: Block): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
      <PublicRichTextBlockView block={block} />
    </NextIntlClientProvider>,
  );
}

describe('PublicRichTextBlockView', () => {
  beforeAll(async () => {
    await Loadable.preloadAll();
  });
  it('renders a canonical, non-autoplay player for an exact standalone link', () => {
    const html = renderPublicRichText(paragraph([youtubeLink]));
    const iframe = html.match(/<iframe[^>]+>/)?.[0] ?? '';

    expect(html).toContain('<iframe');
    expect(iframe).toContain('autoplay=0');
    expect(iframe).not.toContain('autoplay=1');
    expect(iframe).not.toContain('allow="autoplay');
    expect(html).toContain(`href="${youtubeLink.href!.replace('&', '&amp;')}"`);
  });

  it('keeps a mixed paragraph as an ordinary link', () => {
    const html = renderPublicRichText(paragraph([{ type: 'text', text: 'Watch ', styles: {} }, youtubeLink]));

    expect(html).not.toContain('<iframe');
    expect(html).toContain('<p');
    expect(html).toContain('>Recorded session<');
  });

  it('applies persisted width, alignment, and aspect ratio to the public player', () => {
    const html = renderPublicRichText({
      ...paragraph([youtubeLink]),
      props: { displaySize: '42', textAlignment: 'center', aspectRatio: '4:3' },
    });

    expect(html).toContain('style="width:42%;margin-left:auto;margin-right:auto"');
    expect(html).toContain('aspect-ratio:4 / 3');
  });
});
