// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesignSystemTestProvider } from '@/test/TestProviders';
import { SiteLogo } from './SiteLogo';

const mock = vi.hoisted(() => ({
  settings: {
    site_title: null as string | null,
    logo_full_light_url: null as string | null,
    logo_full_dark_url: null as string | null,
    logo_symbol_light_url: null as string | null,
    logo_symbol_dark_url: null as string | null,
  },
}));
vi.mock('@/lib/contexts/ManifestContext', () => ({ useSiteSettings: () => mock }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  mock.settings.site_title = null;
  mock.settings.logo_full_light_url = null;
  mock.settings.logo_full_dark_url = null;
  mock.settings.logo_symbol_light_url = null;
  mock.settings.logo_symbol_dark_url = null;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
function render(form?: 'full' | 'symbol') {
  act(() =>
    root.render(
      <DesignSystemTestProvider forceColorScheme="light">
        <SiteLogo size="xl" form={form} />
      </DesignSystemTestProvider>,
    ),
  );
}

describe('SiteLogo identity', () => {
  it('uses the configured site title at the requested typography size when no logo is configured', () => {
    mock.settings.site_title = 'Archive Studio';
    render();
    expect(host.textContent).toBe('Archive Studio');
    expect(host.querySelector('[data-core-typography]')).toHaveAttribute('data-size', 'xl');
    expect(host.querySelector('img')).toBeNull();
  });
  it('renders the light and dark files of the requested form', () => {
    mock.settings.site_title = 'Archive Studio';
    mock.settings.logo_full_light_url = 'https://cdn.example.test/full-light.svg';
    mock.settings.logo_full_dark_url = 'https://cdn.example.test/full-dark.svg';
    mock.settings.logo_symbol_light_url = 'https://cdn.example.test/symbol-light.svg';
    mock.settings.logo_symbol_dark_url = 'https://cdn.example.test/symbol-dark.svg';
    render();
    expect([...host.querySelectorAll('img')].map((img) => img.getAttribute('src'))).toEqual([
      'https://cdn.example.test/full-light.svg',
      'https://cdn.example.test/full-dark.svg',
    ]);
    render('symbol');
    expect([...host.querySelectorAll('img')].map((img) => img.getAttribute('src'))).toEqual([
      'https://cdn.example.test/symbol-light.svg',
      'https://cdn.example.test/symbol-dark.svg',
    ]);
    expect(host.querySelector('img')?.getAttribute('alt')).toBe('Archive Studio');
  });
  it('uses LOGO when no site title or logo is configured', () => {
    render();
    expect(host.textContent).toBe('LOGO');
    expect(host.textContent).not.toBe('Site logo');
  });
});
