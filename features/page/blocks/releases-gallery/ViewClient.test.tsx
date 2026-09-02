// @vitest-environment jsdom

import { act, type AnchorHTMLAttributes, type HTMLAttributes, type ImgHTMLAttributes, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { parseReleaseListProps } from './schema';
import { ReleaseListViewClient } from './ViewClient';

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

describe('ReleaseListViewClient', () => {
  beforeEach(() => {
    installMatchMedia();
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
  });

  it('renders release artists as artist links in metadata', () => {
    act(() => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={{ common: { actions: { view: 'View' } } }}>
          <MantineProvider>
            <ReleaseListViewClient
              releases={[
                {
                  id: 'release-1',
                  href: '/releases/release-1',
                  title: 'Release One',
                  imageUrl: 'https://example.com/release.jpg',
                  imageAlt: 'Release One',
                  releaseDate: '2026-04-08T00:00:00.000Z',
                  mainArtists: [
                    {
                      id: 'artist-1',
                      label: 'Artist One',
                      href: '/artists/artist-one',
                    },
                    {
                      id: 'artist-2',
                      label: 'Artist Two',
                      href: '/artists/artist-two',
                    },
                  ],
                },
              ]}
              parsedProps={parseReleaseListProps({
                layout: 'grid',
                columns: '3',
                showMeta: 'true',
              })}
            />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });

    const releaseCard = document.querySelector('.release-list-block');
    expect(
      releaseCard?.querySelector('a[href="/releases/release-1"] img[src="https://example.com/release.jpg"]'),
    ).not.toBeNull();
    expect(releaseCard?.querySelector('a[href="/artists/artist-one"]')?.textContent).toContain('Artist One');
    expect(releaseCard?.querySelector('a[href="/artists/artist-two"]')?.textContent).toContain('Artist Two');
    expect(releaseCard?.textContent).toContain('4/8/2026');
  });

  it('renders fallback release metadata when artist and date are missing', () => {
    act(() => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={{ common: { actions: { view: 'View' } } }}>
          <MantineProvider>
            <ReleaseListViewClient
              releases={[
                {
                  id: 'release-1',
                  href: '/releases/release-1',
                  title: 'Release One',
                  imageUrl: null,
                  imageAlt: 'Release One',
                  releaseDate: null,
                  mainArtists: [],
                },
              ]}
              parsedProps={parseReleaseListProps({
                layout: 'grid',
                columns: '3',
                showMeta: 'true',
              })}
            />
          </MantineProvider>
        </NextIntlClientProvider>,
      );
    });

    const releaseCard = document.querySelector('.release-list-block');
    expect(releaseCard?.textContent).toContain('Unknown');
    expect(releaseCard?.textContent).toContain('TBA');
  });
});
