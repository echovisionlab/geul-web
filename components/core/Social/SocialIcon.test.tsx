// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getSocialIconBrandColors,
  mapProviderBrandColors,
  prepareSocialIcon,
  SocialIcon,
  type SocialIconProps,
} from './SocialIcon';
import { SocialIconGlyph, type SocialIconGlyphProps } from './SocialIconGlyph';

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
    const icon = renderIcon(<SocialIcon platform="facebook" size="lg" />);

    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.hasAttribute('role')).toBe(false);
    expect(icon.getAttribute('focusable')).toBe('false');
    expect(icon.getAttribute('width')).toBe('1.125rem');
    expect(icon.getAttribute('height')).toBe('1.125rem');
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
    expect(icon.style.getPropertyValue('--_social-brand-light')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(icon.getAttribute('fill')).toBe('currentColor');
  });

  it('uses a GitHub dark override and falls back to light for platforms without one', () => {
    const githubColors = getSocialIconBrandColors('github');
    const bandcampColors = getSocialIconBrandColors('bandcamp');

    expect(githubColors.dark).toBe('#f0f6fc');
    expect(githubColors.dark).not.toBe(githubColors.light);
    expect(bandcampColors.dark).toBeUndefined();

    const bandcamp = renderIcon(<SocialIcon platform="bandcamp" colorMode="brand" />);
    expect(bandcamp.style.getPropertyValue('--_social-brand-dark')).toBe(
      bandcamp.style.getPropertyValue('--_social-brand-light'),
    );
  });

  it.each(['twitter', 'tiktok', 'threads', 'medium', 'patreon', 'discogs', 'tidal', 'letterboxd', 'mixcloud'] as const)(
    'uses the official white monochrome variant for %s on dark surfaces',
    (platform) => {
      expect(getSocialIconBrandColors(platform).dark).toBe('#ffffff');
    },
  );
});

describe('Google identity icon', () => {
  it('draws the four-segment mark from the fixed provider palette in brand mode', () => {
    const icon = renderIcon(<SocialIcon platform="google" colorMode="brand" size="md" />);
    const segments = Array.from(icon.querySelectorAll('path'));
    expect(icon.getAttribute('data-social-platform')).toBe('google');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.getAttribute('width')).toBe('1rem');
    expect(segments.map((path) => path.style.getPropertyValue('--_social-segment-color'))).toEqual([
      mapProviderBrandColors.google.blue,
      mapProviderBrandColors.google.green,
      mapProviderBrandColors.google.yellow,
      mapProviderBrandColors.google.red,
    ]);
  });

  it('keeps a named standalone image and the closed size scale', () => {
    const icon = renderIcon(<SocialIcon platform="google" label="Google" />);
    expect(icon.getAttribute('role')).toBe('img');
    expect(icon.getAttribute('aria-label')).toBe('Google');
    expect(() =>
      renderIcon(<SocialIcon {...({ platform: 'google', size: '17vw' } as unknown as SocialIconProps)} />),
    ).toThrow(RangeError);
  });
});

describe('SocialIconGlyph', () => {
  it('serializes a prepared glyph with registry colors only', () => {
    expect(JSON.parse(JSON.stringify(prepareSocialIcon('bandcamp')))).toEqual({
      platform: 'bandcamp',
      path: expect.any(String),
      light: getSocialIconBrandColors('bandcamp').light,
    });
  });

  it('renders prepared brand data while stripping presentation overrides from JavaScript callers', () => {
    const hostile = {
      style: { opacity: 0.5, color: 'red' },
      className: 'prepared-icon',
      stroke: 'blue',
      strokeWidth: 8,
      width: 900,
      'data-geul-theme': 'dark',
    } as unknown as SocialIconGlyphProps;
    const prepared = prepareSocialIcon('github');
    const icon = renderIcon(
      <SocialIconGlyph {...hostile} icon={prepared} size="xl" colorMode="hoverBrand" label="Prepared GitHub" />,
    );
    expect(icon.querySelector('path')?.getAttribute('d')).toBe(prepared.path);
    expect(icon.getAttribute('data-social-platform')).toBe('github');
    expect(icon.style.getPropertyValue('--_social-brand-light')).toBe('#181717');
    expect(icon.style.getPropertyValue('--_social-brand-dark')).toBe('#f0f6fc');
    expect(icon.style.opacity).toBe('');
    expect(icon.style.color).toBe('');
    expect(icon.classList.contains('prepared-icon')).toBe(false);
    expect(icon.hasAttribute('stroke')).toBe(false);
    expect(icon.hasAttribute('stroke-width')).toBe(false);
    expect(icon.hasAttribute('data-geul-theme')).toBe(false);
    expect(icon.getAttribute('width')).toBe('1.25rem');
    expect(icon.getAttribute('aria-label')).toBe('Prepared GitHub');
    expect(icon.getAttribute('role')).toBe('img');
  });

  it('rejects arbitrary sizes arriving from JavaScript callers', () => {
    expect(() =>
      renderIcon(<SocialIcon {...({ platform: 'github', size: '17vw' } as unknown as SocialIconProps)} />),
    ).toThrow(RangeError);
  });
});
