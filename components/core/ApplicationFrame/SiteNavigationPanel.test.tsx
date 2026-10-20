// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteNavigationPanel } from './SiteNavigationPanel';

let host: HTMLDivElement;
let root: Root;

function render(opened: boolean, onClose = vi.fn()) {
  act(() =>
    root.render(
      <div data-frame-kind="site">
        <header>
          <button type="button" aria-controls="site-menu" aria-expanded={opened}>
            Menu
          </button>
        </header>
        <main>Content</main>
        <footer>Footer</footer>
        <SiteNavigationPanel id="site-menu" opened={opened} onClose={onClose} label="Navigation">
          <a href="/works">works</a>
        </SiteNavigationPanel>
      </div>,
    ),
  );
  return onClose;
}

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('SiteNavigationPanel', () => {
  function mount() {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  }

  it('covers the page behind while open and releases it when closed', () => {
    mount();
    render(true);
    const panel = document.getElementById('site-menu')!;
    expect(panel.hidden).toBe(false);
    expect(panel.getAttribute('aria-label')).toBe('Navigation');
    expect(host.querySelector('main')!.hasAttribute('inert')).toBe(true);
    expect(host.querySelector('footer')!.hasAttribute('inert')).toBe(true);
    expect(host.querySelector('header')!.hasAttribute('inert')).toBe(false);
    expect(document.documentElement.hasAttribute('data-site-navigation-open')).toBe(true);

    render(false);
    expect(panel.hidden).toBe(true);
    expect(host.querySelector('main')!.hasAttribute('inert')).toBe(false);
    expect(document.documentElement.hasAttribute('data-site-navigation-open')).toBe(false);
  });

  it('closes on Escape and returns focus to the toggle', () => {
    mount();
    const onClose = render(true);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(host.querySelector('button[aria-controls="site-menu"]'));
  });
});
