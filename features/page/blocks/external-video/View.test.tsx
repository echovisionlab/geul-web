import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageExternalVideoView } from './View';

describe('PageExternalVideoView', () => {
  it('applies the explicit page aspect ratio and preserves the original link', () => {
    const html = renderToStaticMarkup(
      <PageExternalVideoView
        props={{
          url: 'https://youtube.com/shorts/dQw4w9WgXcQ',
          caption: 'Portrait interview',
          aspectRatio: '4:3',
        }}
      />,
    );

    expect(html).toContain('<iframe');
    expect(html).toContain('aspect-ratio:4 / 3');
    expect(html).toContain('autoplay=0');
    expect(html).toContain('href="https://youtube.com/shorts/dQw4w9WgXcQ"');
  });

  it('uses a safe original-link fallback for an unsupported URL', () => {
    const html = renderToStaticMarkup(
      <PageExternalVideoView
        props={{
          url: 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
          caption: 'Original source',
          aspectRatio: 'auto',
        }}
      />,
    );

    expect(html).not.toContain('<iframe');
    expect(html).toContain('href="https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"');
  });
});
