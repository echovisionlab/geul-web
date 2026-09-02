// @vitest-environment jsdom

import { act, type AnchorHTMLAttributes, type HTMLAttributes, type ImgHTMLAttributes, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { EntityListView } from './EntityListView';
import type { ListViewLayout } from './ListViewShell';

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
    unoptimized,
    ...props
  }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
    src: string | { src: string };
    unoptimized?: boolean;
  }) => (
    <img
      src={typeof src === 'string' ? src : src.src}
      alt={alt}
      data-unoptimized={unoptimized ? 'true' : undefined}
      {...props}
    />
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

describe('EntityListView', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
    installMatchMedia();
  });

  it('keeps the shared hero carousel slide wrapper for single-item hero layouts', () => {
    const items = [
      {
        id: 'artist-1',
        href: '/artists/artist-1',
        title: 'Artist One',
        imageUrl: 'https://example.com/artist.jpg',
      },
    ];

    act(() => {
      root?.render(
        <MantineProvider>
          <NextIntlClientProvider locale="en" messages={{ common: { actions: { view: 'View' } } }}>
            <EntityListView
              items={items}
              className="artist-list-block"
              emptyLabel="No artists found"
              layout="carousel"
              columns={1}
              showImage
              carouselLoop
              carouselIndicators
            />
          </NextIntlClientProvider>
        </MantineProvider>,
      );
    });

    const heroSlide = document.querySelector('[data-hero-carousel-slide]');
    expect(heroSlide).not.toBeNull();
    expect(heroSlide?.querySelector('img[src="https://example.com/artist.jpg"]')).not.toBeNull();
  });

  it('links grid media to the entity href', () => {
    const items = [
      {
        id: 'artist-1',
        href: '/artists/artist-1',
        title: 'Artist One',
        imageUrl: 'https://example.com/artist.jpg',
      },
    ];

    act(() => {
      root?.render(
        <MantineProvider>
          <NextIntlClientProvider locale="en" messages={{ common: { actions: { view: 'View' } } }}>
            <EntityListView
              items={items}
              className="artist-list-block"
              emptyLabel="No artists found"
              layout="grid"
              columns={3}
              showImage
              carouselLoop
              carouselIndicators
            />
          </NextIntlClientProvider>
        </MantineProvider>,
      );
    });

    expect(
      document.querySelector('a[href="/artists/artist-1"] img[src="https://example.com/artist.jpg"]'),
    ).not.toBeNull();
  });

  it.each([
    ['grid', 'grid', 3],
    ['list', 'list', 3],
    ['cards', 'cards', 3],
    ['carousel cards', 'carousel', 3],
    ['hero carousel', 'carousel', 1],
  ] as const)(
    'renders svg media unoptimized, contained, and centered in the %s layout',
    (_name: string, layout: ListViewLayout, columns: number) => {
      const items = [
        {
          id: 'label-1',
          href: '/labels/label-1',
          title: 'Label One',
          imageUrl: 'https://example.com/label.svg?version=1',
        },
      ];

      act(() => {
        root?.render(
          <MantineProvider>
            <NextIntlClientProvider locale="en" messages={{ common: { actions: { view: 'View' } } }}>
              <EntityListView
                items={items}
                className="label-list-block"
                emptyLabel="No labels found"
                layout={layout}
                columns={columns}
                showImage
                carouselLoop
                carouselIndicators
              />
            </NextIntlClientProvider>
          </MantineProvider>,
        );
      });

      const image = document.querySelector<HTMLImageElement>('img[src="https://example.com/label.svg?version=1"]');
      expect(image).not.toBeNull();
      expect(image?.dataset.unoptimized).toBe('true');
      expect(image?.style.objectFit).toBe('contain');
      expect(image?.style.objectPosition).toBe('center');
    },
  );

  it.each([
    ['list', 'list', 3],
    ['cards', 'cards', 3],
    ['carousel cards', 'carousel', 3],
  ] as const)(
    'renders svg media on a transparent frame in the %s layout',
    (_name: string, layout: ListViewLayout, columns: number) => {
      const items = [
        {
          id: 'label-1',
          href: '/labels/label-1',
          title: 'Label One',
          imageUrl: 'https://example.com/label.svg',
        },
      ];

      act(() => {
        root?.render(
          <MantineProvider>
            <NextIntlClientProvider locale="en" messages={{ common: { actions: { view: 'View' } } }}>
              <EntityListView
                items={items}
                className="label-list-block"
                emptyLabel="No labels found"
                layout={layout}
                columns={columns}
                showImage
                carouselLoop
                carouselIndicators
              />
            </NextIntlClientProvider>
          </MantineProvider>,
        );
      });

      const image = document.querySelector<HTMLImageElement>('img[src="https://example.com/label.svg"]');
      const frame = image?.closest('a')?.parentElement ?? image?.parentElement;

      expect(image).not.toBeNull();
      expect(frame?.style.backgroundColor).toBe('transparent');
    },
  );
});
