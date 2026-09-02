// @vitest-environment jsdom

import { act, type AnchorHTMLAttributes, type HTMLAttributes, type ImgHTMLAttributes, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { parsePostListProps } from './schema';
import { PostListViewClient } from './ViewClient';

vi.mock('next/link', () => ({
  default: ({ href, children, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    ...props
  }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string | { src: string } }) => (
    <img src={typeof src === 'string' ? src : src.src} alt={alt} {...props} />
  ),
}));

vi.mock('@mantine/carousel', () => {
  const Carousel = ({
    children,
    withControls,
    withIndicators,
    ...props
  }: HTMLAttributes<HTMLDivElement> & {
    withControls?: boolean;
    withIndicators?: boolean;
  }) => (
    <div
      data-with-controls={String(Boolean(withControls))}
      data-with-indicators={String(Boolean(withIndicators))}
      {...props}
    >
      {children}
    </div>
  );

  Carousel.Slide = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return { Carousel };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function installMatchMedia(matches: (query: string) => boolean = () => false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: matches(query),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
}

installMatchMedia();

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

const post = {
  id: 'post-1',
  slug: 'first-post',
  title: 'First Post',
  summary: 'Summary',
  featured_image_url: 'https://example.com/post.jpg',
  published_at: '2026-04-06T00:00:00.000Z',
  authors: [
    {
      id: 'user-1',
      name: 'Writer One',
      image: 'https://example.com/avatar.jpg',
    },
  ],
  categories: [
    {
      id: 'category-1',
      name: 'Insights',
      slug: 'insights',
    },
  ],
  tags: [
    {
      id: 'tag-1',
      name: 'Featured',
      slug: 'featured',
    },
  ],
};

const multiAuthorPost = {
  ...post,
  authors: [
    {
      id: 'user-1',
      name: 'Writer One',
      image: 'https://example.com/avatar-1.jpg',
    },
    {
      id: 'user-2',
      name: 'Writer Two',
      image: 'https://example.com/avatar-2.jpg',
    },
    {
      id: 'user-3',
      name: 'Writer Three',
      image: 'https://example.com/avatar-3.jpg',
    },
  ],
};

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <NextIntlClientProvider locale="en" messages={{ common: { actions: { view: 'View' } } }}>
        <MantineProvider>{node}</MantineProvider>
      </NextIntlClientProvider>,
    );
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function clickElement(element: Element | null) {
  expect(element).not.toBeNull();

  act(() => {
    element?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    element?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });

  await flush();
}

beforeEach(() => {
  installMatchMedia();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe('PostListViewClient', () => {
  it('renders grid layout with title-only navigation and expanded metadata', async () => {
    render(
      <PostListViewClient
        posts={[post]}
        parsedProps={parsePostListProps({ layout: 'grid', columns: '3', showMeta: 'true' })}
      />,
    );

    const authorLink = Array.from(document.querySelectorAll('a[href="/user/user-1"]')).find((link) =>
      link.textContent?.includes('Writer One'),
    );
    expect(authorLink?.textContent).toContain('Writer One');

    await clickElement(authorLink ?? null);
    const gridCard = document.querySelector('[data-post-list-item-layout="grid"]');
    expect(gridCard).not.toBeNull();
    expect(gridCard?.getAttribute('role')).toBeNull();
    expect(gridCard?.querySelector('a[href="/posts/first-post"]')).not.toBeNull();
    expect(
      gridCard?.querySelector('a[href="/posts/first-post"] img[src="https://example.com/post.jpg"]'),
    ).not.toBeNull();
    expect(gridCard?.querySelector('[data-post-list-grid-content]')).not.toBeNull();
    expect(gridCard?.querySelector('[data-post-list-grid-meta]')).not.toBeNull();
    expect(gridCard?.textContent).toContain('Category:');
    expect(gridCard?.textContent).toContain('Insights');
    expect(gridCard?.textContent).toContain('Tag:');
    expect(gridCard?.textContent).toContain('Featured');
    expect(gridCard?.textContent).not.toContain('Summary');
    expect(gridCard?.querySelector('a[href="/category/insights"]')).not.toBeNull();
    expect(gridCard?.querySelector('a[href="/tag/featured"]')).not.toBeNull();
  });

  it('renders list layout as a compact row with title-only navigation and author/date metadata only', () => {
    render(
      <PostListViewClient
        posts={[post]}
        parsedProps={parsePostListProps({ layout: 'list', columns: '3', showMeta: 'true' })}
      />,
    );

    const listItem = document.querySelector('[data-post-list-item-layout="list"]');
    expect(listItem).not.toBeNull();
    expect(listItem?.getAttribute('role')).toBeNull();
    expect(listItem?.querySelector('[data-post-list-list-media]')).not.toBeNull();
    expect(
      listItem?.querySelector(
        '[data-post-list-list-media] a[href="/posts/first-post"] img[src="https://example.com/post.jpg"]',
      ),
    ).not.toBeNull();
    expect(listItem?.querySelector('[data-post-list-list-content]')).not.toBeNull();
    expect(listItem?.querySelector('[data-post-list-list-meta]')).not.toBeNull();
    expect(listItem?.querySelector('[data-post-list-list-taxonomy]')).toBeNull();
    expect(listItem?.querySelector('a[href="/posts/first-post"]')).not.toBeNull();
    expect(listItem?.textContent).toContain('Writer One');
    expect(listItem?.textContent).not.toContain('Category:');
    expect(listItem?.textContent).not.toContain('Insights');
    expect(listItem?.textContent).not.toContain('Tag:');
    expect(listItem?.textContent).not.toContain('Featured');
  });

  it('renders minimal layout with title-only navigation and date-only meta', () => {
    render(
      <PostListViewClient
        posts={[post]}
        parsedProps={parsePostListProps({ layout: 'minimal', columns: '3', showMeta: 'true' })}
      />,
    );

    const minimalItem = document.querySelector('[data-post-list-item-layout="minimal"]');
    expect(minimalItem).not.toBeNull();
    expect(minimalItem?.querySelector('[data-post-list-minimal-content]')).not.toBeNull();
    expect(minimalItem?.querySelector('[data-post-list-minimal-meta]')).not.toBeNull();
    expect(minimalItem?.querySelector('a[href="/posts/first-post"]')).not.toBeNull();
    expect(minimalItem?.querySelector('[data-post-list-list-media]')).toBeNull();
    expect(minimalItem?.textContent).not.toContain('Writer One');
    expect(minimalItem?.textContent).toContain('4/6/2026');
    expect(minimalItem?.textContent).not.toContain('Category:');
    expect(minimalItem?.textContent).not.toContain('Tag:');
    expect(minimalItem?.textContent).not.toContain('Summary');
  });

  it('hides authors entirely in minimal layout even when multiple authors exist', () => {
    render(
      <PostListViewClient
        posts={[multiAuthorPost]}
        parsedProps={parsePostListProps({ layout: 'minimal', columns: '3', showMeta: 'true' })}
      />,
    );

    const minimalItem = document.querySelector('[data-post-list-item-layout="minimal"]');
    expect(minimalItem?.textContent).not.toContain('Writer One');
    expect(minimalItem?.textContent).not.toContain('Writer Two');
    expect(minimalItem?.textContent).not.toContain('+1');
    expect(minimalItem?.textContent).toContain('4/6/2026');
  });

  it('renders author profile links in hero carousel slides', () => {
    render(
      <PostListViewClient
        posts={[post]}
        parsedProps={parsePostListProps({ layout: 'carousel', columns: '1', showMeta: 'true' })}
      />,
    );

    const authorLinks = Array.from(document.querySelectorAll('a[href="/user/user-1"]'));
    expect(authorLinks.length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('Writer One');
  });

  it('compresses hero carousel authors on mobile so the CTA can stay on its own row', () => {
    installMatchMedia((query) => query === '(max-width: 48em)');

    render(
      <PostListViewClient
        posts={[multiAuthorPost]}
        parsedProps={parsePostListProps({ layout: 'carousel', columns: '1', showMeta: 'true' })}
      />,
    );

    const heroSlide = document.querySelector('[data-hero-carousel-slide]');
    expect(heroSlide?.textContent).toContain('Writer One');
    expect(heroSlide?.textContent).not.toContain('Writer Two');
    expect(heroSlide?.textContent).toContain('+2');
    expect(heroSlide?.textContent).toContain('View');
    expect(heroSlide?.textContent).not.toContain('Summary');
    expect(heroSlide?.querySelector('[data-hero-bottom-layout="row"]')).not.toBeNull();
  });

  it('uses dots only on mobile hero carousel and keeps arrows plus dots on desktop', () => {
    render(
      <PostListViewClient
        posts={[post, { ...post, id: 'post-2', slug: 'second-post', title: 'Second Post' }]}
        parsedProps={parsePostListProps({ layout: 'carousel', columns: '1', showMeta: 'true' })}
      />,
    );

    const desktopCarousel = document.querySelector('.post-list-block');
    expect(desktopCarousel?.getAttribute('data-with-controls')).toBe('true');
    expect(desktopCarousel?.getAttribute('data-with-indicators')).toBe('true');

    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;

    installMatchMedia((query) => query === '(max-width: 48em)');

    render(
      <PostListViewClient
        posts={[post, { ...post, id: 'post-2', slug: 'second-post', title: 'Second Post' }]}
        parsedProps={parsePostListProps({ layout: 'carousel', columns: '1', showMeta: 'true' })}
      />,
    );

    const mobileCarousel = document.querySelector('.post-list-block');
    expect(mobileCarousel?.getAttribute('data-with-controls')).toBe('false');
    expect(mobileCarousel?.getAttribute('data-with-indicators')).toBe('true');
  });

  it('renders cards layout with a dedicated side media region', () => {
    render(
      <PostListViewClient
        posts={[post]}
        parsedProps={parsePostListProps({ layout: 'cards', columns: '2', showMeta: 'true' })}
      />,
    );

    const card = document.querySelector('[data-post-list-item-layout="cards"]');
    expect(card).not.toBeNull();
    expect(card?.getAttribute('role')).toBeNull();
    expect(card?.querySelector('[data-post-list-card-media]')).not.toBeNull();
    expect(card?.querySelector('[data-post-list-card-content]')).not.toBeNull();
    expect(card?.querySelector('[data-post-list-card-meta]')).not.toBeNull();
    expect(card?.textContent).toContain('First Post');
    expect(card?.querySelector('a[href="/posts/first-post"]')).not.toBeNull();
    expect(
      card?.querySelector(
        '[data-post-list-card-media] a[href="/posts/first-post"] img[src="https://example.com/post.jpg"]',
      ),
    ).not.toBeNull();
    expect(card?.textContent).toContain('Writer One');
    expect(card?.textContent).toContain('Category:');
    expect(card?.textContent).toContain('Insights');
    expect(card?.textContent).toContain('Tag:');
    expect(card?.textContent).toContain('Featured');
    expect(card?.textContent).not.toContain('Summary');
    expect(card?.querySelector('a[href="/user/user-1"] img')).not.toBeNull();
    expect(card?.querySelector('a[href="/category/insights"]')).not.toBeNull();
    expect(card?.querySelector('a[href="/tag/featured"]')).not.toBeNull();
  });

  it('limits card authors to two visible links and shows an overflow label', () => {
    render(
      <PostListViewClient
        posts={[multiAuthorPost]}
        parsedProps={parsePostListProps({ layout: 'cards', columns: '2', showMeta: 'true' })}
      />,
    );

    const card = document.querySelector('[data-post-list-item-layout="cards"]');
    expect(card?.querySelectorAll('a[href^="/user/"]')).toHaveLength(2);
    expect(card?.textContent).toContain('Writer One');
    expect(card?.textContent).toContain('Writer Two');
    expect(card?.textContent).not.toContain('Writer Three');
    expect(card?.textContent).toContain('+1');
  });

  it('renders carousel cards with a horizontal media-and-content layout', () => {
    render(
      <PostListViewClient
        posts={[post, { ...post, id: 'post-2', slug: 'second-post', title: 'Second Post' }]}
        parsedProps={parsePostListProps({ layout: 'carousel', columns: '2', showMeta: 'true' })}
      />,
    );

    const card = document.querySelector('[data-post-list-item-layout="carousel-cards"]');
    expect(card).not.toBeNull();
    expect(card?.querySelector('[data-post-list-carousel-card-layout]')).not.toBeNull();
    expect(card?.querySelector('[data-post-list-carousel-card-media]')).not.toBeNull();
    expect(card?.querySelector('[data-post-list-carousel-card-content]')).not.toBeNull();
    expect(card?.textContent).toContain('First Post');
    expect(card?.textContent).not.toContain('Summary');
    expect(card?.querySelector('a[href="/posts/first-post"]')).not.toBeNull();
  });
});
