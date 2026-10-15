import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PublicMetadataLink, PublicMetadataRow, PublicMetadataRows, PublicMetadataValueGroup } from './PublicMetadata';
import { MetadataPair } from './MetadataPair';

function renderMetadata(node: ReactNode) {
  return renderToStaticMarkup(<DesignSystemProvider>{node}</DesignSystemProvider>);
}

describe('PublicMetadata', () => {
  it('shares the compact scale with nested metadata links and blocks runtime style escapes', () => {
    const html = renderMetadata(
      <MetadataPair label="Visibility" size="xs" {...({ style: { fontSize: 32 }, className: 'escape' } as {})}>
        <PublicMetadataLink href="/visibility/private">Private</PublicMetadataLink>
      </MetadataPair>,
    );
    expect(html).toContain('data-size="xs"');
    expect(html).not.toContain('data-size="sm"');
    expect(html).not.toContain('font-size:32');
    expect(html).not.toContain('escape');
    expect(html).toContain('href="/visibility/private"');
    expect(html).toContain('role="term"');
    expect(html).toMatch(/role="definition" aria-labelledby="[^"]+"/);
  });
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

  it('propagates the inverse tone marker for dark image-backed headers', () => {
    const html = renderMetadata(
      <PublicMetadataRows tone="inverse">
        <PublicMetadataRow label="Published">2026</PublicMetadataRow>
      </PublicMetadataRows>,
    );

    expect(html).toContain('data-tone="inverse"');
    expect(html).toContain('Published');
    expect(html).toContain('2026');
  });

  it('marks non-text values that should center within the metadata line', () => {
    const html = renderMetadata(
      <PublicMetadataRow label="Social" valueAlign="center">
        <svg role="img" aria-label="Instagram" />
      </PublicMetadataRow>,
    );

    expect(html).toContain('data-align="center"');
    expect(html).toContain('aria-label="Instagram"');
  });
});
