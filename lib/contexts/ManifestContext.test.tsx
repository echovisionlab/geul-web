// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ManifestProvider, useSiteSocialLinks } from './ManifestContext';

function FooterSlot() {
  return <footer>{useSiteSocialLinks()}</footer>;
}

it('defaults to an empty footer slot and projects supplied content during SSR', () => {
  expect(renderToStaticMarkup(<FooterSlot />)).toBe('<footer></footer>');
  expect(
    renderToStaticMarkup(
      <ManifestProvider socialLinks={<a href="https://example.com">Example</a>}>
        <FooterSlot />
      </ManifestProvider>,
    ),
  ).toBe('<footer><a href="https://example.com">Example</a></footer>');
});

it('replaces server-prepared footer content when provider props update', () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <ManifestProvider socialLinks={<span>First</span>}>
          <FooterSlot />
        </ManifestProvider>,
      ),
    );
    expect(host.textContent).toBe('First');
    act(() =>
      root.render(
        <ManifestProvider socialLinks={<span>Second</span>}>
          <FooterSlot />
        </ManifestProvider>,
      ),
    );
    expect(host.textContent).toBe('Second');
    act(() =>
      root.render(
        <ManifestProvider>
          <FooterSlot />
        </ManifestProvider>,
      ),
    );
    expect(host.textContent).toBe('');
  } finally {
    act(() => root.unmount());
  }
});
