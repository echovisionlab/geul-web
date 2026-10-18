// @vitest-environment jsdom
import { mockBrowserNavigation } from '../testing/browser-navigation';
import { act, createRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider } from 'react-aria-components';
import { NavigationIntentProvider } from './NavigationIntentProvider';
import { NavigationPrefetchContext } from './navigation-prefetch';
import { NavigationLink } from './NavigationLink';

const browserNavigation = mockBrowserNavigation();

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  browserNavigation.attach(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
function render(node: ReactNode) {
  act(() => root.render(node));
}
describe('NavigationLink', () => {
  it('wraps a logo or image in a named, content-sized graphic link', () => {
    render(
      <NavigationLink href="https://example.com" appearance="graphic" aria-label="Go home">
        <img alt="" src="/logo.svg" />
      </NavigationLink>,
    );
    const anchor = host.querySelector('a')!;
    expect(anchor.dataset.appearance).toBe('graphic');
    expect(anchor.getAttribute('aria-label')).toBe('Go home');
    expect(anchor.getAttribute('href')).toBe('https://example.com');
  });
  it('preserves an anchor ref, object href and routing options through the application guard', () => {
    const guard = vi.fn();
    const navigate = vi.fn();
    const ref = createRef<HTMLAnchorElement>();
    render(
      <RouterProvider navigate={navigate}>
        <NavigationIntentProvider onNavigationIntent={guard}>
          <NavigationLink
            href={{ pathname: '/documents', query: { edition: '2' } }}
            replace
            scroll={false}
            aria-label="Open document"
            ref={ref}
          >
            Document
          </NavigationLink>
        </NavigationIntentProvider>
      </RouterProvider>,
    );
    const anchor = host.querySelector('a')!;
    expect(anchor).toBe(ref.current);
    expect(anchor.getAttribute('href')).toBe('/documents?edition=2');
    act(() => anchor.click());
    expect(guard).toHaveBeenCalledWith(
      { href: 'http://localhost:3000/documents?edition=2', replace: true, scroll: false },
      { preventDefault: expect.any(Function) },
    );
    expect(navigate).toHaveBeenCalledOnce();
  });
  it('lets the caller prevent navigation before the application guard or router runs', () => {
    const guard = vi.fn();
    const navigate = vi.fn();
    render(
      <RouterProvider navigate={navigate}>
        <NavigationIntentProvider onNavigationIntent={guard}>
          <NavigationLink href="/private" onNavigate={(event) => event.preventDefault()}>
            Private
          </NavigationLink>
        </NavigationIntentProvider>
      </RouterProvider>,
    );
    act(() => host.querySelector('a')!.click());
    expect(guard).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it('lets an unsaved-change guard cancel the router transition', () => {
    const navigate = vi.fn();
    render(
      <RouterProvider navigate={navigate}>
        <NavigationIntentProvider onNavigationIntent={(_, event) => event.preventDefault()}>
          <NavigationLink href="/documents">Documents</NavigationLink>
        </NavigationIntentProvider>
      </RouterProvider>,
    );
    act(() => host.querySelector('a')!.click());
    expect(navigate).not.toHaveBeenCalled();
  });
  it('leaves modified clicks, downloads and external links outside the client guard', () => {
    const guard = vi.fn();
    render(
      <NavigationIntentProvider onNavigationIntent={guard}>
        <NavigationLink href="/normal">Normal</NavigationLink>
        <NavigationLink href="/file" download>
          File
        </NavigationLink>
        <NavigationLink href="https://example.com">External</NavigationLink>
      </NavigationIntentProvider>,
    );
    const links = host.querySelectorAll('a');
    act(() => links[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })));
    act(() => links[1].click());
    act(() => links[2].click());
    expect(guard).not.toHaveBeenCalled();
    expect(browserNavigation.navigate.mock.calls.map(([intent]) => intent.href)).toEqual([
      'http://localhost:3000/normal',
      'http://localhost:3000/file',
      'https://example.com/',
    ]);
    expect(browserNavigation.navigate.mock.calls[0][0].ctrlKey).toBe(true);
    expect(browserNavigation.navigate.mock.calls[1][0].download).toBe('');
  });
  it('prefetches ordinary same-origin navigation on focus and honors opt-outs and browser-only navigation', () => {
    const prefetch = vi.fn();
    render(
      <NavigationPrefetchContext.Provider value={prefetch}>
        <NavigationLink href="/documents?edition=2">Documents</NavigationLink>
        <NavigationLink href="/private" prefetch={false}>
          Private
        </NavigationLink>
        <NavigationLink href="/file" download>
          File
        </NavigationLink>
        <NavigationLink href="/new" target="_blank">
          New window
        </NavigationLink>
        <NavigationLink href="https://example.com">External</NavigationLink>
      </NavigationPrefetchContext.Provider>,
    );
    act(() => {
      for (const anchor of host.querySelectorAll('a')) {
        anchor.focus();
      }
    });
    expect(prefetch).toHaveBeenCalledExactlyOnceWith('/documents?edition=2');
  });
  it('keeps native advisory text and tab order that React Aria Link would filter', () => {
    render(
      <NavigationLink href="/help" title="Opens help" tabIndex={-1}>
        Help
      </NavigationLink>,
    );
    const anchor = host.querySelector('a')!;
    expect(anchor.title).toBe('Opens help');
    expect(anchor.tabIndex).toBe(-1);
  });
});
