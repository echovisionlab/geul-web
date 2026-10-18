// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { createTranslationClient } from '@/lib/api/browser/secure-translation';
import { TranslationAdminPreview } from './TranslationAdmin.stories';
vi.mock('@/lib/api/browser/secure-translation', () => ({
  createTranslationClient: vi.fn(() => {
    throw new Error('Preview attempted a backend transport');
  }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/admin/translations',
  useSearchParams: () => new URLSearchParams(),
}));
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
async function expectEventually(assertion: () => void) {
  await vi.waitFor(async () => {
    await act(async () => {
      // Let queued query notifications reach React before checking the observable state.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assertion();
  });
}
async function render(surface: 'overview' | 'settings' | 'jobs', state: 'ready' | 'error' = 'ready') {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <TestProviders>
        <TranslationAdminPreview surface={surface} state={state} />
      </TestProviders>,
    ),
  );
}
describe('translation page preview controllers', () => {
  it('cancels an active job through the local RPC and refreshes the production table', async () => {
    await render('jobs');
    await expectEventually(() => expect(host.textContent).toContain('night-signals'));
    const cancel = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Cancel'),
    )!;
    expect(cancel).toBeDefined();
    expect(host.querySelector('table[aria-label="Translation Jobs"]')).not.toBeNull();
    expect(cancel.getAttribute('aria-label')).toContain('night-signals');
    expect(cancel.getAttribute('aria-label')).toContain('KO');
    act(() => cancel.focus());
    await act(async () => cancel.click());
    await expectEventually(() => expect(host.textContent).not.toContain('night-signals'));
    expect(host.querySelector('[role="status"]')?.textContent).toBe('No translation jobs yet.');
    expect((document.activeElement as HTMLButtonElement).textContent).toContain('Refresh');
    expect(createTranslationClient).not.toHaveBeenCalled();
  });
});
