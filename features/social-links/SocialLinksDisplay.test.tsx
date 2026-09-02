// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialLinksDisplay } from './SocialLinksDisplay';

let container: HTMLDivElement;
let root: Root;

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
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function renderDisplay(node: React.ReactNode) {
  act(() => root.render(<MantineProvider>{node}</MantineProvider>));
}

describe('SocialLinksDisplay', () => {
  it('renders ordered platform links through Core/Social', () => {
    renderDisplay(
      <SocialLinksDisplay
        links={{
          0: 'https://instagram.com/example-studio',
          1: 'https://signal-unit.bandcamp.com',
        }}
      />,
    );

    const links = Array.from(container.querySelectorAll('a'));
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual(['Instagram', 'Bandcamp']);
    expect(links.map((link) => link.querySelector('svg')?.getAttribute('data-social-platform'))).toEqual([
      'instagram',
      'bandcamp',
    ]);
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
  });

  it('passes brand color mode to list icons and keeps labels visible', () => {
    renderDisplay(
      <SocialLinksDisplay
        links={{ facebook: 'https://facebook.com/example-studio' }}
        variant="list"
        showLabels
        iconColor="brand"
      />,
    );

    expect(container.textContent).toContain('Facebook');
    expect(container.querySelector('[data-social-platform="facebook"]')?.getAttribute('data-color-mode')).toBe('brand');
  });
});
