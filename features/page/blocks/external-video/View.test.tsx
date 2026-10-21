import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import enMessages from '@/messages/en.json';
import { PageExternalVideoView } from './View';

const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
      {node}
    </NextIntlClientProvider>,
  );

describe('PageExternalVideoView', () => {
  it('applies the explicit page aspect ratio and waits for consent before loading the player', () => {
    const html = render(
      <PageExternalVideoView
        props={{
          url: 'https://youtube.com/shorts/dQw4w9WgXcQ',
          caption: 'Portrait interview',
          aspectRatio: '4:3',
        }}
      />,
    );

    expect(html).not.toContain('<iframe');
    expect(html).toContain('aria-label="Play Portrait interview"');
    expect(html).toContain('aspect-ratio:4 / 3');
    expect(html).toContain('href="https://youtube.com/shorts/dQw4w9WgXcQ"');
  });

  it('uses a safe original-link fallback for an unsupported URL', () => {
    const html = render(
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
