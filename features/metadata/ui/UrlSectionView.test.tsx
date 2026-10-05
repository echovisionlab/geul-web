// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { UrlSectionView, type UrlSectionViewProps } from './UrlSectionView';

const props: UrlSectionViewProps = {
  entityId: 'entity-id',
  slug: 'example',
  publicUrlById: 'https://example.com/entity-id',
  publicUrlBySlug: 'https://example.com/example',
  labels: {
    title: 'URL',
    description: 'Public URL settings',
    id: 'ID',
    slug: 'Slug',
    slugPlaceholder: 'slug',
    publicUrl: 'Public URL',
    copyId: 'Copy ID',
    copyUrl: 'Copy URL',
    openInNewTab: 'Open in new tab',
  },
  onChange: () => {},
  onCopyId: () => {},
  onCopyUrl: () => {},
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(overrides: Partial<UrlSectionViewProps> = {}) {
  act(() => {
    root.render(
      <MantineProvider>
        <UrlSectionView {...props} {...overrides} />
      </MantineProvider>,
    );
  });
}

describe('UrlSectionView slug status', () => {
  it('shows a spinner while checking and a green check only after availability succeeds', () => {
    render({ saving: true, isAvailable: true });

    const loader = host.querySelector('.mantine-Loader-root');
    expect(loader).not.toBeNull();
    expect(host.querySelector('.tabler-icon-check')).toBeNull();

    for (const slug of ['example-next', 'example-next-again']) {
      render({ saving: true, isAvailable: undefined, slug });

      expect(host.querySelector('.mantine-Loader-root')).toBe(loader);
      expect(host.querySelector('.tabler-icon-check')).toBeNull();
    }

    render({ saving: false, isAvailable: true });

    expect(host.querySelector('.mantine-Loader-root')).toBeNull();
    expect(host.querySelector('.tabler-icon-check')).toHaveAttribute('stroke', 'var(--mantine-color-green-6)');
  });

  it.each([
    { isAvailable: undefined },
    { isAvailable: false },
    { isAvailable: true, error: 'This slug is unavailable' },
    { isAvailable: true, slug: '', publicUrlBySlug: null },
  ])('does not show a success check for an unconfirmed or invalid slug: %j', (overrides) => {
    render(overrides);

    expect(host.querySelector('.tabler-icon-check')).toBeNull();
    expect(host.querySelector('.mantine-Loader-root')).toBeNull();
  });
});
