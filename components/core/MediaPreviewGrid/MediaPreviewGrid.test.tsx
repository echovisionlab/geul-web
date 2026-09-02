import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { MediaPreviewGrid } from './MediaPreviewGrid';

describe('MediaPreviewGrid', () => {
  it('renders arbitrary preview content in one shared grid', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <MediaPreviewGrid>
          <article>First preview</article>
          <article>Second preview</article>
        </MediaPreviewGrid>
      </MantineProvider>,
    );

    expect(html).toContain('First preview');
    expect(html).toContain('Second preview');
  });
});
