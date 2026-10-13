// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesignSystemTestProvider } from '@/test/TestProviders';
import { SiteLogo } from './SiteLogo';

const mock = vi.hoisted(() => ({
  settings: { site_title: null as string | null, logo_url: null, logo_light_url: null, logo_dark_url: null },
}));
vi.mock('@/lib/contexts/ManifestContext', () => ({ useSiteSettings: () => mock }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  mock.settings.site_title = null;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
function render() {
  act(() =>
    root.render(
      <DesignSystemTestProvider forceColorScheme="light">
        <SiteLogo size="xl" />
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
  it('uses LOGO when no site title or logo is configured', () => {
    render();
    expect(host.textContent).toBe('LOGO');
    expect(host.textContent).not.toBe('Site logo');
  });
});
