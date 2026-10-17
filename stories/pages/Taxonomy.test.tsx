// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { TaxonomyPagePreview } from './Taxonomy.stories';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/preview',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/actions/genre', () => ({
  createGenreAction: vi.fn(),
  updateGenreAction: vi.fn(),
  deleteGenreAction: vi.fn(),
}));
vi.mock('@/lib/actions/format', () => ({
  createFormatAction: vi.fn(),
  updateFormatAction: vi.fn(),
  deleteFormatAction: vi.fn(),
}));
vi.mock('@/lib/actions/style', () => ({
  createStyleAction: vi.fn(),
  updateStyleAction: vi.fn(),
  deleteStyleAction: vi.fn(),
}));
vi.mock('@/lib/actions/category', () => ({
  createCategoryAction: vi.fn(),
  updateCategoryAction: vi.fn(),
  deleteCategoryAction: vi.fn(),
}));
vi.mock('@/lib/actions/tag', () => ({ createTagAction: vi.fn(), updateTagAction: vi.fn(), deleteTagAction: vi.fn() }));
vi.mock('@/lib/actions/user-tag', () => ({ createUserTagAction: vi.fn(), deleteUserTagAction: vi.fn() }));
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
function render(domain: 'genres' | 'formats' | 'styles' | 'categories' | 'tags' | 'userTags') {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <TestProviders>
        <TaxonomyPagePreview domain={domain} />
      </TestProviders>,
    ),
  );
}
describe('six actual taxonomy page owners', () => {
  it.each(['genres', 'formats', 'styles', 'categories', 'tags', 'userTags'] as const)(
    'creates through actual %s modal and updates actual table rows',
    async (domain) => {
      render(domain);
      await vi.waitFor(() => expect(host.textContent).toContain('Ambient'));
      const create = Array.from(host.querySelectorAll('button')).find((node) => node.textContent?.startsWith('New '));
      expect(create).toBeDefined();
      await act(async () => create!.click());
      const dialog = await vi.waitFor(() => {
        const match = document.body.querySelector('[role=dialog]');
        expect(match).not.toBeNull();
        return match!;
      });
      const input = dialog.querySelector<HTMLInputElement>('input[required]')!;
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Signal');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const submit = dialog.querySelector<HTMLButtonElement>('button[type=submit]');
      expect(submit).not.toBeNull();
      await act(async () => submit!.click());
      await vi.waitFor(() => {
        expect(host.textContent).toContain('Signal');
        expect(document.body.querySelector('[role=dialog]')).toBeNull();
      });
    },
  );
});
