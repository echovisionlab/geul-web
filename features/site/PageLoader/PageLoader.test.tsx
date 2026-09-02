// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { PageLoader } from './PageLoader';

let settingsMock = {
  loader_urls: [] as string[],
};
let container: HTMLDivElement | null = null;
let root: Root | null = null;

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/contexts/ManifestContext', () => ({
  useSiteSettings: () => ({
    settings: settingsMock,
  }),
}));

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
  it('selects a loader URL from the configured loader pool', () => {
    settingsMock = {
      loader_urls: [
        'https://cdn.example.com/media/site/loader/first.gif',
        'https://cdn.example.com/media/site/loader/second.webp',
      ],
    };
    vi.spyOn(Math, 'random').mockReturnValue(0.9);

    act(() => {
      root?.render(
        <MantineProvider>
          <PageLoader />
        </MantineProvider>,
      );
    });

    const image = container?.querySelector('img');
    expect(image?.getAttribute('src')).toBe('https://cdn.example.com/media/site/loader/second.webp');
  });

  it('renders the Core fallback when the loader relation is empty', () => {
    settingsMock = { loader_urls: [] };

    act(() => {
      root?.render(
        <MantineProvider>
          <PageLoader />
        </MantineProvider>,
      );
    });

    expect(container?.querySelector('img')).toBeNull();
  });
});
