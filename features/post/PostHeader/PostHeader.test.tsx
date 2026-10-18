// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';

import enMessages from '@/messages/en.json';
import { invariantTokens } from '@/components/core/design-tokens';
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

describe('PostHeader action row and metadata grammar', () => {
  it('places the content language control in the same header action row', () => {
    for (const featuredImageUrl of [null, HERO_IMAGE]) {
      render(
        <PostHeader
          post={{ ...BASE_POST, featuredImageUrl }}
          onExport={vi.fn()}
          languageControl={<button type="button">English</button>}
        />,
      );
      const markdown = document.querySelector('[aria-label="Export post as Markdown"]')!;
      const language = Array.from(document.querySelectorAll('button')).find((node) => node.textContent === 'English')!;
      expect(language.parentElement).toBe(markdown.closest('[data-geul-layout]'));
      expect(language.closest('.print-hide')).not.toBeNull();
      act(() => root?.unmount());
      container?.remove();
      root = null;
      container = null;
    }
  });

  it('renders the same metadata rows with slash-separated values in plain and hero headers', () => {
    for (const featuredImageUrl of [null, HERO_IMAGE]) {
      render(
        <PostHeader
          post={{
            ...BASE_POST,
            featuredImageUrl,
            categories: [
              { id: 'cat-1', name: 'Listening' },
              { id: 'cat-2', name: 'Field work' },
            ],
            tags: [
              { id: 'tag-1', name: 'Field recording' },
              { id: 'tag-2', name: 'Archival notes' },
            ],
          }}
          onExport={vi.fn()}
        />,
      );
      expect(getUserLink('Text Collaborator')).toHaveAttribute('href', '/user/collaborator-1');
      const separators = Array.from(document.querySelectorAll('[aria-hidden="true"]')).filter(
        (node) => node.textContent === '/',
      );
      // Single collaborator: none; two categories and two tags: one hidden slash each.
      expect(separators).toHaveLength(2);
      expect(document.querySelector('h1')).toHaveAttribute('data-level', 'title');
      act(() => root?.unmount());
      container?.remove();
      root = null;
      container = null;
    }
  });
});

describe('PostHeader author identities', () => {
  it('keeps the Featured Image hero overlay as one print fragment', () => {
    const css = readFileSync(resolve(process.cwd(), 'features/post/PostHeader/PostHeader.module.css'), 'utf8');
    const printRules = /@media print\s*\{([\s\S]*)\}\s*$/u.exec(css)?.[1];

    expect(printRules).toMatch(/\.hero\s*\{[^}]*min-height:\s*62mm;[^}]*break-inside:\s*avoid;/su);
    expect(printRules).toMatch(/\.heroImage\s*\{[^}]*print-color-adjust:\s*exact;/su);
    // The document layout owns the hero → body gap; paper uses the same image tone as the screen.
    expect(printRules).not.toMatch(/margin|filter/u);
    expect(printRules).toMatch(/\.titleActions\s*\{\s*display:\s*none;/su);
    expect(invariantTokens['text-on-image']).toBe('#ffffff');
  });

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

  it('uses the same avatar identities in inverse hero metadata', () => {
    renderHeader({
      ...BASE_POST,
      featuredImageUrl: HERO_IMAGE,
      collaborators: [],
    });

    const imageAuthor = getUserLink('Image Author');

    expect(imageAuthor).toHaveAttribute('href', '/user/author-image');
    expect(imageAuthor.querySelector('[data-interactive][data-shape="circle"]')).not.toBeNull();
    expect(invariantTokens['text-inverse-secondary']).toBe('rgb(255 255 255 / 72%)');
    expect(imageAuthor.closest('[data-tone="inverse"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-interactive][data-shape="circle"]')).toHaveLength(3);
  });
});
