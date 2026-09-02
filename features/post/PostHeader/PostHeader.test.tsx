// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import { MantineProvider } from '@mantine/core';
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
        <MantineProvider>{node}</MantineProvider>
      </NextIntlClientProvider>,
    );
  });
}

function renderHeader(post: Post) {
  render(<PostHeader post={post} onShare={vi.fn()} onExport={vi.fn()} />);
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
  it('keeps the Featured Image hero overlay as one print fragment', () => {
    const css = readFileSync(resolve(process.cwd(), 'features/post/PostHeader/PostHeader.module.css'), 'utf8');
    const printRules = /@media print\s*\{([\s\S]*)\}\s*$/u.exec(css)?.[1];

    expect(printRules).toMatch(/\.hero\s*\{[^}]*min-height:\s*62mm\s*!important;[^}]*break-inside:\s*avoid;/su);
    expect(printRules).toMatch(/\.heroOverlay\s*\{[^}]*display:\s*block\s*!important;/su);
    expect(printRules).toMatch(/\.heroImage\s*\{[^}]*position:\s*absolute\s*!important;/su);
    expect(printRules).toMatch(/\.heroContent\s*\{[^}]*color:\s*#fff\s*!important;/su);
  });

  it('uses the compact Core low-emphasis contract for every header action', () => {
    renderHeader({ ...BASE_POST, canEdit: true });

    for (const label of ['Edit post', 'Share post', 'Print post', 'Export post as Markdown']) {
      const button = document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
      expect(button).not.toBeNull();
      expect(button).toHaveAttribute('data-size', 'sm');
      expect(button).toHaveAttribute('data-tone', 'neutral');
      expect(button).toHaveAttribute('data-emphasis', 'low');
      expect(button).not.toHaveStyle({ color: 'inherit' });
      expect(button?.querySelector('svg')).toHaveAttribute('width', '16');
      expect(button?.querySelector('svg')).toHaveAttribute('height', '16');
    }
  });

  it('renders every standard-header author as an avatar link and keeps collaborators text-only', () => {
    renderHeader(BASE_POST);

    const imageAuthor = getUserLink('Image Author');
    const fallbackAuthor = getUserLink('Fallback Author');
    const unknownAuthor = getUserLink('Unknown');
    const collaborator = getUserLink('Text Collaborator');

    expect(imageAuthor).toHaveAttribute('href', '/user/author-image');
    expect(imageAuthor.querySelector('img')).toHaveAttribute('src', AVATAR_IMAGE);
    expect(fallbackAuthor.querySelector('.mantine-Avatar-root')).toHaveTextContent('F');
    expect(unknownAuthor).toHaveAttribute('href', '/user/author-unknown');
    expect(document.querySelectorAll('.mantine-Avatar-root')).toHaveLength(3);
    expect(collaborator).toHaveAttribute('href', '/user/collaborator-1');
    expect(collaborator.querySelector('.mantine-Avatar-root')).toBeNull();
    expect(imageAuthor.closest('[data-align="center"]')).not.toBeNull();
  });

  it('uses the same avatar identities with an inverse border in the hero header', () => {
    renderHeader({
      ...BASE_POST,
      featuredImageUrl: HERO_IMAGE,
      collaborators: [],
    });

    const imageAuthor = getUserLink('Image Author');

    expect(imageAuthor).toHaveAttribute('href', '/user/author-image');
    expect(imageAuthor.querySelector('.mantine-Avatar-root')).not.toBeNull();
    expect(imageAuthor.style.getPropertyValue('--user-inline-avatar-border-color')).toBe('rgba(255, 255, 255, 0.72)');
    expect(imageAuthor.closest('[data-tone="inverse"]')).not.toBeNull();
    expect(document.querySelectorAll('.mantine-Avatar-root')).toHaveLength(3);
  });
});
