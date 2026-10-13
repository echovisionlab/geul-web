import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MediaPreviewGrid } from './MediaPreviewGrid';

describe('MediaPreviewGrid', () => {
  it('renders arbitrary preview content in one shared grid', () => {
    const html = renderToStaticMarkup(
      <DesignSystemProvider>
        <MediaPreviewGrid>
          <article>First preview</article>
          <article>Second preview</article>
        </MediaPreviewGrid>
      </DesignSystemProvider>,
    );

    expect(html).toContain('First preview');
    expect(html).toContain('Second preview');
  });
});
