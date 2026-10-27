// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DesignSystemTestProvider } from '@/test/TestProviders';
import { SiteLogoView, type SiteLogoSize } from './SiteLogoView';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
function render(content: React.ReactNode) {
  act(() => root.render(<DesignSystemTestProvider forceColorScheme="light">{content}</DesignSystemTestProvider>));
}

describe('SiteLogoView fallback', () => {
  it.each<SiteLogoSize>(['xs', 'sm', 'md', 'lg', 'xl'])(
    'uses the existing %s typography role for the site title',
    (size) => {
      render(<SiteLogoView src={null} alt="Site logo" fallbackText="Example Studio" size={size} />);
      const wordmark = host.querySelector('[data-core-typography="text"]');
      expect(wordmark?.textContent).toBe('Example Studio');
      expect(wordmark).toHaveAttribute('data-size', size);
      expect(wordmark).toHaveAttribute('data-weight', 'medium');
      expect(host.querySelector('img')).toBeNull();
    },
  );

  it('uses LOGO when site identity is absent and does not display the image alt description as identity', () => {
    render(<SiteLogoView src={null} alt="Site logo" fallbackText={null} size="xl" />);
    expect(host.textContent).toBe('LOGO');
  });

  it('preserves descriptive alt and explicit asset geometry while an image exists', () => {
    render(<SiteLogoView src="/logo.svg" alt="Example Studio" size="xl" height={24} />);
    const image = host.querySelector('img');
    expect(image).toHaveAttribute('src', '/logo.svg');
    expect(image).toHaveAttribute('alt', 'Example Studio');
    expect(image?.style.height).toBe('24px');
    expect(host.querySelector('[data-core-typography]')).toBeNull();
  });

  it('falls back when an asset fails and attempts a new asset URL after a source change', () => {
    render(<SiteLogoView src="/missing.svg" alt="Site logo" fallbackText="Example Studio" size="xl" />);
    act(() => host.querySelector('img')!.dispatchEvent(new Event('error')));
    expect(host.textContent).toBe('Example Studio');
    expect(host.querySelector('img')).toBeNull();
    render(<SiteLogoView src="/replacement.svg" alt="Example Studio" size="xl" />);
    expect(host.querySelector('img')).toHaveAttribute('src', '/replacement.svg');
  });

  it('uses the named font-size token for default image geometry and ignores empty asset URLs', () => {
    render(<SiteLogoView src="/logo.svg" alt="Example Studio" size="xl" />);
    expect(host.querySelector('img')?.style.height).toBe('1.25rem');
    render(<SiteLogoView src="  " alt="Example Studio" />);
    expect(host.textContent).toBe('Example Studio');
    expect(host.querySelector('img')).toBeNull();
  });
});

describe('SiteLogoView theme variants', () => {
  it('renders both theme marks so the document theme picks one before hydration', () => {
    render(<SiteLogoView src="/logo-light.svg" darkSrc="/logo-dark.svg" alt="Site logo" height="intrinsic" />);
    const images = [...host.querySelectorAll('img')];
    expect(images.map((image) => [image.getAttribute('data-logo-scheme'), image.getAttribute('src')])).toEqual([
      ['light', '/logo-light.svg'],
      ['dark', '/logo-dark.svg'],
    ]);
    expect(images[0]?.style.height).toBe('auto');
    expect(images[0]?.style.maxHeight).toBe('var(--_site-header-brand-max-height, var(--geul-chrome-header-height-sm))');
  });

  it('renders a single mark when there is no separate dark logo', () => {
    render(<SiteLogoView src="/logo-light.svg" darkSrc={null} alt="Site logo" />);
    const images = host.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0]).not.toHaveAttribute('data-logo-scheme');
  });

  it('uses the dark mark alone when only a dark logo exists', () => {
    render(<SiteLogoView src={null} darkSrc="/logo-dark.svg" alt="Site logo" />);
    const images = host.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('src', '/logo-dark.svg');
  });
});
