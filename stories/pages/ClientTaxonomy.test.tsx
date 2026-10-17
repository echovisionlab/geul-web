// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { ClientEditorPreview } from './ClientEditor.stories';
import { PostTaxonomyPreview } from './PostTaxonomy.stories';
import { settleInAct, waitInAct, wrapQueryNotificationsInAct } from '@/test/act-wait';

// Full production page renders: a loaded CI worker needs more than the default 5s per test.
vi.setConfig({ testTimeout: 20_000 });
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ id: 'client-preview' }),
}));
vi.mock('@/lib/actions/client', () => ({
  createClientAction: vi.fn(),
  updateClientAction: vi.fn(),
  deleteClientLogoAction: vi.fn(),
  setClientLogoAction: vi.fn(),
}));
vi.mock('@/lib/queries/client-browser', () => ({ getClient: vi.fn() }));
vi.mock('@/lib/queries/post-browser', () => ({ listPublishedPostsByTaxonomy: vi.fn() }));
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);
let host: HTMLDivElement, root: Root;
wrapQueryNotificationsInAct();
afterEach(async () => {
  await settleInAct();
  act(() => root?.unmount());
  host?.remove();
});
function render(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<TestProviders>{node}</TestProviders>));
}
describe('actual detail and taxonomy page owners', () => {
  it('loads the real client edit query/baseline and both logo controls', async () => {
    render(<ClientEditorPreview />);
    await waitInAct(() => expect(host.querySelector<HTMLInputElement>('input[required]')?.value).toBe('Quiet Signal'));
    expect(host.querySelectorAll('input[type=file]').length).toBe(2);
    const name = host.querySelector<HTMLInputElement>('input[required]')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Updated Client');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const save = Array.from(host.querySelectorAll('button')).find((node) => node.textContent === 'Save');
    expect(save).toBeDefined();
    await act(async () => save!.click());
    await waitInAct(() => expect(host.querySelector('[role=alert]')?.textContent).toBe('Save'));
  });
  it('keeps the actual create-client branch without logo upload controls', () => {
    render(<ClientEditorPreview state="new" />);
    expect(host.querySelector('input[required]')).not.toBeNull();
    expect(host.querySelector('input[type=file]')).toBeNull();
  });
  it.each(['category', 'tag'] as const)('loads actual %s post-list columns/query owner', async (kind) => {
    render(<PostTaxonomyPreview kind={kind} />);
    await waitInAct(() => expect(host.textContent).toContain('June Han'));
    expect(host.querySelector('a[href="/posts/listening-notes"]')).not.toBeNull();
    expect(host.querySelector('input[placeholder="Search posts..."]')).not.toBeNull();
  });
});
