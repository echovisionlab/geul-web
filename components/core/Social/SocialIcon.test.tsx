// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSocialIconBrandColors, prepareSocialIcon, SocialIcon } from './SocialIcon';

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
});

describe('SocialIconGlyph', () => {
  it('serializes a prepared glyph with registry colors only', () => {
    expect(JSON.parse(JSON.stringify(prepareSocialIcon('bandcamp')))).toEqual({
      platform: 'bandcamp',
      path: expect.any(String),
      light: getSocialIconBrandColors('bandcamp').light,
    });
  });
});
