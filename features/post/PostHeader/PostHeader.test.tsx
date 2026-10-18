// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';

import enMessages from '@/messages/en.json';
import { PostHeader } from './PostHeader';

const AVATAR_IMAGE = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="#426c77" />
    <circle cx="32" cy="25" r="13" fill="#f1c7a5" />
    <path d="M9 64c2-17 10-25 23-25s21 8 23 25Z" fill="#15242a" />
  </svg>
`)}`;

const HERO_IMAGE = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600">
    <rect width="1200" height="600" fill="#35545d" />
  </svg>
`)}`;

type Post = Parameters<typeof PostHeader>[0]['post'];

const BASE_POST: Post = {
  id: 'post-1',
  slug: 'field-notes',
  title: 'Field notes',
  summary: null,
  featuredImageUrl: null,
  publishedAt: new Date('2026-07-20T12:00:00.000Z'),
  updatedAt: new Date('2026-07-20T12:00:00.000Z'),
  canEdit: false,
  authors: [
    { id: 'author-image', name: 'Image Author', image: AVATAR_IMAGE },
    { id: 'author-fallback', name: 'Fallback Author', image: null },
    { id: 'author-unknown', name: null, image: null },
  ],
  collaborators: [{ id: 'collaborator-1', name: 'Text Collaborator', image: AVATAR_IMAGE, role: 'editor' }],
  categories: null,
  tags: null,
  locationPlace: null,
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DesignSystemProvider locale="en" forceColorScheme="light">
          {node}
        </DesignSystemProvider>
      </NextIntlClientProvider>,
    );
  });
}

function renderHeader(post: Post) {
  render(<PostHeader post={post} onExport={vi.fn()} />);
}

function getUserLink(label: string): HTMLAnchorElement {
  const link = document.querySelector<HTMLAnchorElement>(`a[aria-label="${label}"]`);
  expect(link).not.toBeNull();
  return link!;
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe('PostHeader author identities', () => {
  it('renders every standard-header author as an avatar link and keeps collaborators text-only', () => {
    renderHeader(BASE_POST);

    const imageAuthor = getUserLink('Image Author');
    const fallbackAuthor = getUserLink('Fallback Author');
    const unknownAuthor = getUserLink('Unknown');
    const collaborator = getUserLink('Text Collaborator');

    expect(imageAuthor).toHaveAttribute('href', '/user/author-image');
    expect(imageAuthor.querySelector('img')).toHaveAttribute('src', AVATAR_IMAGE);
    expect(fallbackAuthor.querySelector('[data-interactive][data-shape="circle"]')).toHaveTextContent('F');
    expect(unknownAuthor).toHaveAttribute('href', '/user/author-unknown');
    expect(document.querySelectorAll('[data-interactive][data-shape="circle"]')).toHaveLength(3);
    expect(collaborator).toHaveAttribute('href', '/user/collaborator-1');
    expect(collaborator.querySelector('[data-interactive][data-shape="circle"]')).toBeNull();
    expect(imageAuthor.closest('[data-align="center"]')).not.toBeNull();
  });

  it('preserves the featured image and all long-title metadata in growing flow chrome', () => {
    const title = 'A long field journal title that continues across lines on narrow screens';
    renderHeader({
      ...BASE_POST,
      title,
      featuredImageUrl: HERO_IMAGE,
      categories: [{ id: 'cat-1', name: 'Long environmental recording studies' }],
      tags: [{ id: 'tag-1', name: 'Archival listening notes' }],
    });
    const hero = document.querySelector<HTMLElement>('[data-post-hero]')!;
    expect(hero).toHaveTextContent(title);
    expect(hero).toHaveTextContent('Long environmental recording studies');
    expect(hero).toHaveTextContent('Archival listening notes');
    expect(hero.querySelector('[data-geul-media-image]')).toHaveAttribute('alt', title);
    expect(hero.querySelector('[data-geul-media-image]')).toHaveAttribute('src', HERO_IMAGE);
    expect(hero.querySelector('h1')?.closest('[data-placement]')).toHaveAttribute('data-placement', 'flow');
    expect(hero.style.marginLeft).toBe('');
    expect(hero.style.marginRight).toBe('');
  });
});
