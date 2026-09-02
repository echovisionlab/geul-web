// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSocialIconBrandColors, SocialIcon } from './SocialIcon';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderIcon(icon: React.ReactNode): SVGSVGElement {
  act(() => root.render(icon));

  const svg = container.querySelector('svg');
  if (!svg) {
    throw new Error('Expected a social icon.');
  }
  return svg;
}

describe('SocialIcon', () => {
  it('renders the configured platform path as a decorative icon by default', () => {
    const icon = renderIcon(<SocialIcon platform="facebook" size={18} />);

    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.hasAttribute('role')).toBe(false);
    expect(icon.getAttribute('focusable')).toBe('false');
    expect(icon.getAttribute('width')).toBe('18');
    expect(icon.getAttribute('height')).toBe('18');
    expect(icon.querySelector('path')?.getAttribute('d')).toBeTruthy();
  });

  it('provides a single accessible image name when used standalone', () => {
    const icon = renderIcon(<SocialIcon platform="instagram" label="Instagram" />);

    expect(icon.getAttribute('role')).toBe('img');
    expect(icon.getAttribute('aria-label')).toBe('Instagram');
    expect(icon.hasAttribute('aria-hidden')).toBe(false);
    expect(icon.querySelector('title')).toBeNull();
  });

  it('exposes brand and hover-brand color modes without leaking icon metadata', () => {
    const icon = renderIcon(<SocialIcon platform="bandcamp" colorMode="hoverBrand" data-testid="bandcamp" />);

    expect(icon.getAttribute('data-social-platform')).toBe('bandcamp');
    expect(icon.getAttribute('data-color-mode')).toBe('hoverBrand');
    expect(icon.style.getPropertyValue('--social-icon-brand-light')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(icon.getAttribute('fill')).toBe('currentColor');
  });

  it('uses a GitHub dark override and falls back to light for platforms without one', () => {
    const githubColors = getSocialIconBrandColors('github');
    const bandcampColors = getSocialIconBrandColors('bandcamp');

    expect(githubColors.dark).toBe('#f0f6fc');
    expect(githubColors.dark).not.toBe(githubColors.light);
    expect(bandcampColors.dark).toBeUndefined();

    const bandcamp = renderIcon(<SocialIcon platform="bandcamp" colorMode="brand" />);
    expect(bandcamp.style.getPropertyValue('--social-icon-brand-dark')).toBe(
      bandcamp.style.getPropertyValue('--social-icon-brand-light'),
    );
  });

  it.each(['twitter', 'tiktok', 'threads', 'medium', 'patreon', 'discogs', 'tidal', 'letterboxd', 'mixcloud'] as const)(
    'uses the official white monochrome variant for %s on dark surfaces',
    (platform) => {
      expect(getSocialIconBrandColors(platform).dark).toBe('#ffffff');
    },
  );
});
