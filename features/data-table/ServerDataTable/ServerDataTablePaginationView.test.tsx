// @vitest-environment jsdom
import { mockBrowserNavigation } from '@/components/core/testing/browser-navigation';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { ServerDataTablePaginationView } from './ServerDataTablePaginationView';

const browserNavigation = mockBrowserNavigation();
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
describe('server table page navigation', () => {
  it.each(['ctrlKey', 'metaKey', 'shiftKey', 'altKey'] as const)(
    'preserves native link intent for %s without invoking the client-navigation adapter',
    (modifier) => {
      const navigate = vi.fn();
      host = document.createElement('div');
      document.body.append(host);
      root = createRoot(host);
      browserNavigation.attach(host);
      act(() =>
        root.render(
          <TestProviders>
            <ServerDataTablePaginationView
              currentPage={3}
              totalPages={8}
              getPageUrl={(page) => `/admin/posts?page=${page}`}
              onNavigate={navigate}
              labels={{
                navigation: 'Post pages',
                firstPage: 'First page',
                previousPage: 'Previous page',
                page: (page) => `Page ${page}`,
                nextPage: 'Next page',
                lastPage: 'Last page',
              }}
            />
          </TestProviders>,
        ),
      );
      const next = host.querySelector<HTMLAnchorElement>('a[aria-label="Next page"]')!;
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, [modifier]: true });
      act(() => next.dispatchEvent(click));
      expect(navigate).not.toHaveBeenCalled();
      expect(browserNavigation.navigate).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ href: next.href, [modifier]: true }),
      );
      expect(next.getAttribute('href')).toBe('/admin/posts?page=4');
      act(() => next.click());
      expect(navigate).toHaveBeenCalledExactlyOnceWith('/admin/posts?page=4');
      expect(browserNavigation.navigate).toHaveBeenCalledTimes(1);
    },
  );

  it('names the navigation, marks the current page, and preserves the visible numbers', () => {
    const navigate = vi.fn();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    browserNavigation.attach(host);
    act(() =>
      root.render(
        <TestProviders>
          <ServerDataTablePaginationView
            currentPage={3}
            totalPages={8}
            getPageUrl={(page) => `/admin/posts?page=${page}`}
            onNavigate={navigate}
            labels={{
              navigation: 'Post pages',
              firstPage: 'First page',
              previousPage: 'Previous page',
              page: (page) => `Page ${page}`,
              nextPage: 'Next page',
              lastPage: 'Last page',
            }}
          />
        </TestProviders>,
      ),
    );
    const nav = host.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Post pages');
    expect(nav?.querySelector('[aria-current="page"]')?.textContent).toBe('3');
    expect(nav?.querySelectorAll('[aria-current="page"]').length).toBe(1);
    const next = nav?.querySelector<HTMLAnchorElement>('a[aria-label="Next page"]');
    expect(next?.getAttribute('href')).toBe('/admin/posts?page=4');
    act(() => next?.click());
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/admin/posts?page=4');
    expect(nav?.querySelector('a[aria-label="Page 8"]')?.textContent).toBe('8');
  });

  it('keeps first/previous bounds as disabled non-links and the server ellipsis range', () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    browserNavigation.attach(host);
    act(() =>
      root.render(
        <TestProviders>
          <ServerDataTablePaginationView
            currentPage={1}
            totalPages={8}
            getPageUrl={(page) => `/admin/posts?page=${page}`}
            labels={{
              firstPage: 'First page',
              previousPage: 'Previous page',
              page: (page) => `Page ${page}`,
              nextPage: 'Next page',
              lastPage: 'Last page',
            }}
          />
        </TestProviders>,
      ),
    );
    for (const label of ['First page', 'Previous page']) {
      const bound = host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
      expect(bound?.tagName).toBe('BUTTON');
      expect(bound?.disabled).toBe(true);
    }
    expect([...host.querySelectorAll('a')].map((link) => link.textContent || link.getAttribute('aria-label'))).toEqual([
      '1',
      '2',
      '3',
      '8',
      'Next page',
      'Last page',
    ]);
    expect(host.querySelector('a[aria-label="Last page"]')?.getAttribute('href')).toBe('/admin/posts?page=8');
  });

  it('renders nothing for empty data unless the footer slot is reserved', () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    browserNavigation.attach(host);
    const labels = {
      firstPage: 'First page',
      previousPage: 'Previous page',
      page: (page: number) => `Page ${page}`,
      nextPage: 'Next page',
      lastPage: 'Last page',
    };
    act(() =>
      root.render(
        <TestProviders>
          <ServerDataTablePaginationView currentPage={1} totalPages={0} getPageUrl={String} labels={labels} />
        </TestProviders>,
      ),
    );
    expect(host.querySelector('nav')).toBeNull();
    act(() =>
      root.render(
        <TestProviders>
          <ServerDataTablePaginationView
            currentPage={1}
            totalPages={0}
            getPageUrl={String}
            labels={labels}
            reserveSpaceWhenHidden
          />
        </TestProviders>,
      ),
    );
    expect(host.querySelector('nav')).toBeNull();
    expect(host.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
