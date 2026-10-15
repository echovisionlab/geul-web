// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { LoginErrorPageView } from '@/features/auth/LoginErrorPageView';
import { SitemapPageView } from '@/features/navigation/SitemapPageView';
import { ChangelogPageView } from '@/features/changelog/ChangelogPageView';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/preview',
  useSearchParams: () => new URLSearchParams(),
}));
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
async function render(view: ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<TestProviders>{view}</TestProviders>));
}
describe('production public page previews', () => {
  it('offers account recovery only for pending deletion', async () => {
    await render(<LoginErrorPageView error={{ id: 'account_pending_deletion' }} />);
    expect(host.querySelector('a[href="/account/recover"]')?.textContent).toContain('Recover Account');
    await act(async () =>
      root.render(
        <TestProviders>
          <LoginErrorPageView error={{ id: 'account_banned' }} />
        </TestProviders>,
      ),
    );
    expect(host.querySelector('a[href="/account/recover"]')).toBeNull();
    expect(host.querySelector('a[href="/login"]')?.textContent).toContain('Back to Login');
  });
  it('uses actual sitemap navigation destinations', async () => {
    await render(<SitemapPageView />);
    expect(host.querySelector('a[href="/"]')?.textContent).toContain('Home');
    expect(host.querySelector('a[href="/artists"]')?.textContent).toContain('Artists');
    expect(host.querySelector('a[href="/privacy"]')?.textContent).toContain('Privacy Policy');
  });
  it('keeps authored changelog release anchors and safe external links', async () => {
    await render(
      <ChangelogPageView
        releases={[
          {
            version: '0.11.2',
            date: '2026-10-10',
            url: null,
            groups: [
              {
                title: 'Fixes',
                items: [
                  {
                    rawText: 'Issue',
                    parts: [
                      { type: 'link', text: 'Issue', href: 'https://github.com/echovisionlab/geul-web/issues/1' },
                    ],
                  },
                ],
              },
            ],
          },
        ]}
      />,
    );
    expect(host.querySelector('[id="release-0.11.2"]')?.textContent).toBe('0.11.2');
    const link = host.querySelector('a[href="https://github.com/echovisionlab/geul-web/issues/1"]');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(host.querySelector('[id="release-0.11.2-fixes"]')?.textContent).toBe('Fixes');
    expect(host.querySelector('[lang="en"]')).not.toBeNull();
  });
});
