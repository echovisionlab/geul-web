import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { PublicMetadataLink, PublicMetadataRow, PublicMetadataRows, PublicMetadataValueGroup } from './PublicMetadata';

function renderMetadata(node: ReactNode) {
  return renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>);
}

describe('PublicMetadata', () => {
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
