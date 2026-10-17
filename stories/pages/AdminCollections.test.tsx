// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { notifyManager } from '@tanstack/react-query';
import { TestProviders } from '@/test/TestProviders';
import { AdminCollectionPagePreview } from './AdminCollections.stories';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/preview',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@/lib/actions/client', () => ({ createClientAction: vi.fn(), deleteClientAction: vi.fn() }));
vi.mock('@/lib/actions/series', () => ({ createSeriesAction: vi.fn(), deleteSeriesAction: vi.fn() }));
vi.mock('@/lib/actions/work', () => ({
  createWorkAction: vi.fn(),
  deleteWorkAction: vi.fn(),
  listWorksAdminAction: vi.fn(),
}));
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  // Deliver query results inside act so waits observe committed renders.
  notifyManager.setNotifyFunction((callback) => {
    act(callback);
  });
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  notifyManager.setNotifyFunction((callback) => callback());
});
function render(domain: 'clients' | 'series' | 'works', state: 'ready' | 'empty' = 'ready') {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <TestProviders>
        <AdminCollectionPagePreview domain={domain} state={state} />
      </TestProviders>,
    ),
  );
}
function findButton(matches: (text: string) => boolean) {
  return vi.waitFor(() => {
    const button = Array.from(host.querySelectorAll('button')).find((node) =>
      matches(node.textContent?.toLowerCase() ?? ''),
    );
    expect(button).toBeDefined();
    return button!;
  });
}
describe('actual collection page controllers', () => {
  it.each(['clients', 'series', 'works'] as const)('renders actual %s table empty owner', async (domain) => {
    render(domain, 'empty');
    await vi.waitFor(() => expect(host.textContent?.toLowerCase()).toContain(`no ${domain}`));
  });
  it('creates a client row using the actual header controller', async () => {
    render('clients');
    const button = await findButton((text) => text.startsWith('new client'));
    await act(async () => button.click());
    expect(host.textContent).toContain('New Client');
    expect(host.querySelector('a[href="/admin/clients/client-2"]')).not.toBeNull();
  });
  it('creates a work and refetches the real client query owner', async () => {
    render('works');
    await vi.waitFor(() => expect(host.textContent).toContain('Night Signals'));
    const button = await findButton((text) => text.includes('new work'));
    await act(async () => button.click());
    await vi.waitFor(() => expect(host.textContent).toContain('Untitled Work'));
  });
  it('opens the real series creation form', async () => {
    render('series');
    const button = await findButton((text) => text.includes('create series'));
    await act(async () => button.click());
    expect(document.body.querySelector('[role=dialog]')).not.toBeNull();
    expect(document.body.querySelector('input[required]')).not.toBeNull();
  });
});
