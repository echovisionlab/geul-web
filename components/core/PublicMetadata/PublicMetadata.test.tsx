import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PublicMetadataLink, PublicMetadataRow, PublicMetadataRows, PublicMetadataValueGroup } from './PublicMetadata';

function renderMetadata(node: ReactNode) {
  return renderToStaticMarkup(<DesignSystemProvider>{node}</DesignSystemProvider>);
}

describe('PublicMetadata', () => {
  it('separates group values with a hidden slash only when requested and centers labels with centered values', () => {
    const html = renderMetadata(
      <PublicMetadataRows>
        <PublicMetadataRow label="Tags" valueAlign="center">
          <PublicMetadataValueGroup separator="slash">
            <span>Field recording</span>
            <span>Archival notes</span>
            <span>Rooms</span>
          </PublicMetadataValueGroup>
        </PublicMetadataRow>
        <PublicMetadataRow label="Labels">
          <PublicMetadataValueGroup>
            <span>One</span>
            <span>Two</span>
          </PublicMetadataValueGroup>
        </PublicMetadataRow>
      </PublicMetadataRows>,
    );

    expect(html.match(/aria-hidden="true">\/<\/span>/gu)).toHaveLength(2);
    expect(html).toMatch(/role="term"[^>]*data-align="center"/u);
    expect(html).toMatch(/role="term"[^>]*data-align="baseline"/u);
  });
  it('renders compact label/value rows and value groups', () => {
    const html = renderMetadata(
      <PublicMetadataRows>
        <PublicMetadataRow label="Artists">
          <PublicMetadataValueGroup>
            <PublicMetadataLink href="/artist/one">One</PublicMetadataLink>
            <PublicMetadataLink href="/artist/two">Two</PublicMetadataLink>
          </PublicMetadataValueGroup>
        </PublicMetadataRow>
      </PublicMetadataRows>,
    );

    expect(html).toContain('Artists');
    expect(html).toContain('role="term"');
    expect(html).toMatch(/role="definition" aria-labelledby="[^"]+"/);
    expect(html).toContain('href="/artist/one"');
    expect(html).toContain('href="/artist/two"');
    expect(html).toContain('One');
    expect(html).toContain('Two');
  });

  it('marks external links as safe new-tab links', () => {
    const html = renderMetadata(
      <PublicMetadataLink href="https://example.com/profile" external ariaLabel="Artist website">
        Website
      </PublicMetadataLink>,
    );

    expect(html).toContain('href="https://example.com/profile"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('aria-label="Artist website"');
  });
});
