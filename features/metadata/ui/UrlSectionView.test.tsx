// @vitest-environment jsdom

import { DesignSystemTestProvider as DesignSystemProvider } from '@/test/TestProviders';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    copied: 'Copied',
    openInNewTab: 'Open in new tab',
  },
  onChange: () => {},
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
      <DesignSystemProvider forceColorScheme="light">
        <UrlSectionView {...props} {...overrides} />
      </DesignSystemProvider>,
    );
  });
}

describe('UrlSectionView slug status', () => {
  it('shows a spinner while checking and a green check only after availability succeeds', () => {
    render({ saving: true, isAvailable: true });

    const loader = host.querySelector('[data-testid="slug-availability-spinner"]');
    expect(loader).not.toBeNull();
    expect(host.querySelector('.tabler-icon-check')).toBeNull();

    for (const slug of ['example-next', 'example-next-again']) {
      render({ saving: true, isAvailable: undefined, slug });

      expect(host.querySelector('[data-testid="slug-availability-spinner"]')).toBe(loader);
      expect(host.querySelector('.tabler-icon-check')).toBeNull();
    }

    render({ saving: false, isAvailable: true });

    expect(host.querySelector('[data-testid="slug-availability-spinner"]')).toBeNull();
    expect(host.querySelector('.tabler-icon-check')?.closest('[data-tone]')).toHaveAttribute('data-tone', 'positive');
  });

  it.each([
    { isAvailable: undefined },
    { isAvailable: false },
    { isAvailable: true, error: 'This slug is unavailable' },
    { isAvailable: true, slug: '', publicUrlBySlug: null },
  ])('does not show a success check for an unconfirmed or invalid slug: %j', (overrides) => {
    render(overrides);

    expect(host.querySelector('.tabler-icon-check')).toBeNull();
    expect(host.querySelector('[data-testid="slug-availability-spinner"]')).toBeNull();
  });
});

describe('UrlSectionView fields', () => {
  it('associates visible labels with ID, slug and public URL controls', () => {
    render({ idPrefix: 'work' });

    const labels = Array.from(host.querySelectorAll('label'));
    for (const text of ['ID', 'Slug', 'Public URL']) {
      const label = labels.find((candidate) => candidate.textContent === text);
      const input = label && host.querySelector<HTMLInputElement>(`input[id="${label.htmlFor}"]`);
      expect(input).not.toBeNull();
      expect(input?.value).toBe(text === 'ID' ? props.entityId : text === 'Slug' ? props.slug : props.publicUrlBySlug);
    }
    expect(host.querySelector('#work-id')).toHaveAttribute('readonly');
    expect(host.querySelector('#work-slug')).not.toHaveAttribute('readonly');
    expect(host.querySelector('input[aria-label="Public URL (ID)"]')).toHaveAttribute('readonly');
  });

  it('keeps the public URL label and actions when there is no slug', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render({ slug: '', publicUrlBySlug: null });

    const label = Array.from(host.querySelectorAll('label')).find(
      (candidate) => candidate.textContent === 'Public URL',
    );
    const input = host.querySelector<HTMLInputElement>(`input[id="${label?.htmlFor}"]`);
    expect(input?.value).toBe(props.publicUrlById);
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Copy URL"]')?.click());
    expect(writeText).toHaveBeenCalledWith(props.publicUrlById);
    expect(Array.from(host.querySelectorAll('[role="status"]'), (status) => status.textContent)).toContain('Copied');
    const link = host.querySelector('a[aria-label="Open in new tab"]');
    expect(link).toHaveAttribute('href', props.publicUrlById);
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
