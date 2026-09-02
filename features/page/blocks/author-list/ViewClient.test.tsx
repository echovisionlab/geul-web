// @vitest-environment jsdom

import { act, type AnchorHTMLAttributes, type ImgHTMLAttributes, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { parseAuthorListProps } from './schema';
import { AuthorListViewClient } from './ViewClient';

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
    fill: _fill,
    unoptimized: _unoptimized,
    ...props
  }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
    src: string | { src: string };
    fill?: boolean;
    unoptimized?: boolean;
  }) => <img src={typeof src === 'string' ? src : src.src} alt={alt} {...props} />,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

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

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<MantineProvider>{node}</MantineProvider>);
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe('AuthorListViewClient', () => {
  beforeEach(() => {
    installMatchMedia();
    container = null;
    root = null;
  });

  it('links the author avatar to the author profile', () => {
    render(
      <AuthorListViewClient
        authors={[
          {
            id: 'author-1',
            name: 'Author One',
            image: 'https://example.com/author.jpg',
            bio: 'Author bio',
            post_count: 3,
          },
        ]}
        parsedProps={parseAuthorListProps({ layout: 'grid', showAvatar: 'true' })}
      />,
    );

    expect(document.querySelector('a[href="/user/author-1"] img[src="https://example.com/author.jpg"]')).not.toBeNull();
  });
});
