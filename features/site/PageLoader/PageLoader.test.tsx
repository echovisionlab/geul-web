// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { PageLoader } from './PageLoader';

let settingsMock = {
  loader_urls: [] as string[],
};
let container: HTMLDivElement | null = null;
let root: Root | null = null;

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    unoptimized,
    preload,
    onError,
    width,
    height,
  }: {
    src: string;
    alt: string;
    unoptimized?: boolean;
    preload?: boolean;
    onError?: () => void;
    width?: number;
    height?: number;
  }) => (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      data-unoptimized={String(unoptimized)}
      data-preload={String(preload)}
      width={width}
      height={height}
      onError={onError}
    />
  ),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => () => '불러오는 중...',
}));

vi.mock('@/lib/contexts/ManifestContext', () => ({
  useSiteSettings: () => ({
    settings: settingsMock,
  }),
}));

vi.mock('@/lib/public-runtime-config', () => ({ getPublicCdnUrl: () => 'https://cdn.fixture.test' }));

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  settingsMock = { loader_urls: [] };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

describe('PageLoader', () => {
  it('uses the same first configured GIF for SSR, hydration and rerenders without requesting a second loader', () => {
    settingsMock = {
      loader_urls: [
        'https://cdn.example.com/media/site/loader/first.gif?version=2',
        'https://cdn.example.com/media/site/loader/second.webp',
      ],
    };
    const random = vi.spyOn(Math, 'random');
    const serverMarkup = renderToStaticMarkup(
      <MantineProvider>
        <PageLoader />
      </MantineProvider>,
    );
    expect(serverMarkup).toContain('first.gif?version=2');
    expect(serverMarkup).not.toContain('rel="preload" as="image"');

    act(() => {
      root?.render(
        <MantineProvider>
          <PageLoader />
        </MantineProvider>,
      );
    });

    const image = container?.querySelector('img');
    expect(image?.getAttribute('src')).toBe('https://cdn.example.com/media/site/loader/first.gif?version=2');
    expect(image?.getAttribute('data-unoptimized')).toBe('true');
    expect(image?.getAttribute('data-preload')).toBe('undefined');
    act(() =>
      root?.render(
        <MantineProvider>
          <PageLoader />
        </MantineProvider>,
      ),
    );
    expect(container?.querySelector('img')?.getAttribute('src')).toBe(image?.getAttribute('src'));
    expect(random).not.toHaveBeenCalled();
  });

  it('renders a localized quiet status without a spinner when the loader relation is empty', () => {
    settingsMock = { loader_urls: [] };

    act(() => {
      root?.render(
        <MantineProvider>
          <PageLoader />
        </MantineProvider>,
      );
    });

    expect(container?.querySelector('img')).toBeNull();
    expect(container?.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('불러오는 중...');
    expect(container?.querySelector('[role="status"]')?.textContent).toBe('');
    expect(container?.querySelector('.mantine-Loader-root')).toBeNull();
  });

  it('removes duplicate generic Loading prose and preserves distinct progress messages', () => {
    settingsMock = { loader_urls: ['https://cdn.example.com/loader.gif'] };
    act(() =>
      root?.render(
        <MantineProvider>
          <PageLoader message="불러오는 중..." />
        </MantineProvider>,
      ),
    );
    expect(container?.querySelector('[role="status"]')?.textContent).toBe('');
    act(() =>
      root?.render(
        <MantineProvider>
          <PageLoader message="Redirecting to sign in" />
        </MantineProvider>,
      ),
    );
    expect(container?.textContent).toContain('Redirecting to sign in');
  });

  it('resolves configured managed GIF paths through the existing CDN contract', () => {
    settingsMock = { loader_urls: ['/asset/configured-loader.gif?version=2'] };
    act(() =>
      root?.render(
        <MantineProvider>
          <PageLoader />
        </MantineProvider>,
      ),
    );
    expect(container?.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.fixture.test/asset/configured-loader.gif?version=2',
    );
    expect(container?.querySelector('img')?.getAttribute('data-unoptimized')).toBe('true');
  });

  it('keeps a quiet status on image failure and uses updated configuration without a spinner', () => {
    settingsMock = { loader_urls: ['https://cdn.example.com/loader.gif'] };
    act(() =>
      root?.render(
        <MantineProvider>
          <PageLoader size="sm" minHeight={300} />
        </MantineProvider>,
      ),
    );
    expect(container?.querySelector('img')?.getAttribute('width')).toBe('64');
    act(() => container?.querySelector('img')?.dispatchEvent(new Event('error')));
    expect(container?.querySelector('img')).toBeNull();
    expect(container?.querySelector('[role="status"]')).not.toBeNull();
    expect(container?.querySelector('.mantine-Loader-root')).toBeNull();
    settingsMock = { loader_urls: ['https://cdn.example.com/replacement.svg?version=2'] };
    act(() =>
      root?.render(
        <MantineProvider>
          <PageLoader size="sm" minHeight={300} />
        </MantineProvider>,
      ),
    );
    expect(container?.querySelector('img')?.getAttribute('src')).toContain('replacement.svg');
    expect(container?.querySelector('img')?.getAttribute('data-unoptimized')).toBe('true');
  });
});
