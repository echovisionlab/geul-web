// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { within } from 'storybook/test';
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
async function render(surface: 'overview' | 'settings', state: 'ready' | 'error' = 'ready') {
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
  it('outlines the overview as the page title followed by its sections', async () => {
    await render('overview');
    const page = within(host);
    await expectEventually(() => expect(page.getAllByRole('heading', { level: 2 })).toHaveLength(2));
    const title = page.getByRole('heading', { level: 1, name: 'Translations' });
    expect(page.getAllByRole('heading', { level: 1 })).toEqual([title]);
    for (const section of page.getAllByRole('heading', { level: 2 })) {
      expect(title.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(createTranslationClient).not.toHaveBeenCalled();
  });
  it('projects failed local reads onto the production settings error branch', async () => {
    await render('settings', 'error');
    await expectEventually(() => expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/failed|unable/i));
    expect(host.querySelector('input')).toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/failed|unable/i);
    expect(createTranslationClient).not.toHaveBeenCalled();
  });
});
