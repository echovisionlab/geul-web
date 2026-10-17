// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { within, userEvent } from 'storybook/test';
import { TestProviders } from '@/test/TestProviders';
import { AdminContentPreview } from './AdminContent.stories';
import { waitInAct } from '@/test/act-wait';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/preview',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/actions/post', () => ({ createPostAction: vi.fn(), deletePostAdminAction: vi.fn() }));
vi.mock('@/lib/actions/page', () => ({ createPageAction: vi.fn(), deletePageAdminAction: vi.fn() }));
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);
let host: HTMLDivElement, root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
function render(domain: 'posts' | 'pages', state: 'ready' | 'empty' | 'error' = 'ready') {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <TestProviders>
        <AdminContentPreview domain={domain} state={state} />
      </TestProviders>,
    ),
  );
}
describe('actual content administration page views', () => {
  it.each(['posts', 'pages'] as const)(
    'runs the actual %s creation controller and domain row rendering',
    async (domain) => {
      render(domain);
      const button = await waitInAct(() => {
        const match = Array.from(host.querySelectorAll('button')).find((node) => node.textContent?.startsWith('New '));
        expect(match).toBeDefined();
        return match!;
      });
      await act(async () => button.click());
      await waitInAct(() =>
        expect(host.querySelector(`a[href*="${domain === 'posts' ? 'post' : 'page'}-3"]`)).not.toBeNull(),
      );
    },
  );
});

describe('content list accessibility states', () => {
  it.each(['posts', 'pages'] as const)(
    'keeps %s visible titles and names the table, search, selection and results',
    async (domain) => {
      render(domain);
      const canvas = within(host);
      // The search field is a dynamically imported runtime.
      await waitInAct(() =>
        expect(
          canvas.getByRole('searchbox', { name: domain === 'posts' ? 'Search posts...' : 'Search pages...' }),
        ).toBeDefined(),
      );
      expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe(domain === 'posts' ? 'Posts' : 'Pages');
      expect(canvas.getByRole('table', { name: domain === 'posts' ? 'Posts' : 'Pages' })).toBeDefined();
      expect(canvas.getByRole('checkbox', { name: 'Select all rows' })).toBeDefined();
      for (const checkbox of canvas.getAllByRole('checkbox')) {
        expect(checkbox.getAttribute('aria-label')).toBeTruthy();
      }
      expect(host.querySelector('[role="status"]')?.textContent).toContain('2 results');
      expect(host.querySelector(`a[href*="${domain === 'posts' ? 'post-1' : 'page-1'}"]`)?.textContent).toContain(
        'Listening',
      );
    },
  );
  it.each(['posts', 'pages'] as const)(
    'announces actual empty/error %s states without exposing stale rows',
    async (domain) => {
      render(domain, 'error');
      await waitInAct(() => expect(within(host).getByRole('alert').textContent).toContain('Failed to load'));
      expect(host.querySelector('table')).toBeNull();
    },
  );
  it.each(['posts', 'pages'] as const)(
    'deletes a %s row through its named menu and retains useful focus',
    async (domain) => {
      render(domain);
      const canvas = within(host);
      const name = domain === 'posts' ? 'Listening Notes' : 'Listening Room';
      const trigger = canvas.getAllByRole('button', { name: `Actions for ${name}` })[0];
      act(() => trigger.focus());
      await act(async () => {
        await userEvent.click(trigger);
      });
      const menu = await waitInAct(() => within(document.body).getByRole('menu'));
      await act(async () => {
        await userEvent.click(within(menu).getByRole('menuitem', { name: 'Delete' }));
      });
      const dialog = await waitInAct(() => within(document.body).getByRole('dialog', { name: 'Delete' }));
      expect(dialog.textContent).toContain(name);
      await act(async () => {
        await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
      });
      await waitInAct(() => {
        expect(canvas.queryAllByRole('button', { name: `Actions for ${name}` })[0]).toBeUndefined();
        expect(host.contains(document.activeElement)).toBe(true);
      });
    },
  );
});
