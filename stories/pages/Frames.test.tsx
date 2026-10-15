// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { FramesPreview } from './Frames.stories';
const { useMediaQuery } = vi.hoisted(() => ({ useMediaQuery: vi.fn(() => true) }));
vi.mock('@mantine/hooks', async (original) => ({
  ...(await original<typeof import('@mantine/hooks')>()),
  useMediaQuery,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/posts',
}));
let host: HTMLDivElement, root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  useMediaQuery.mockReturnValue(true);
});
function render(kind: 'public' | 'admin' | 'account') {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <TestProviders>
        <FramesPreview kind={kind} />
      </TestProviders>,
    ),
  );
}
describe('actual application frame previews', () => {
  it('renders real public navigation/footer with placeholder child', () => {
    render('public');
    expect(host.querySelector('header')).not.toBeNull();
    expect(host.querySelector('footer')).not.toBeNull();
    expect(host.querySelector('a[href="/posts"]')).not.toBeNull();
  });
  it('switches the actual admin frame mode using its shared toggle', async () => {
    render('admin');
    const toggle = host.querySelector<HTMLButtonElement>('button[aria-label="Toggle navigation"]');
    expect(toggle).not.toBeNull();
    await act(async () => toggle!.click());
    expect(host.querySelector('[data-admin-shell]')?.getAttribute('data-navigation-mode')).toBe('compact');
  });
  it('changes the actual account selected tab using the local controller', async () => {
    render('account');
    const tab =
      host.querySelector<HTMLElement>('[role=tab][id*=security]') ??
      Array.from(host.querySelectorAll<HTMLElement>('[role=tab]')).find((node) =>
        node.textContent?.includes('Security'),
      );
    expect(tab).toBeDefined();
    await act(async () => tab!.click());
    expect(tab?.getAttribute('aria-selected')).toBe('true');
  });
  it('keeps the actual admin rail compact on phone as the production controller does', () => {
    useMediaQuery.mockReturnValue(false);
    render('admin');
    expect(host.querySelector('[data-admin-shell]')?.getAttribute('data-navigation-mode')).toBe('compact');
    expect(host.querySelector('button[aria-label="Toggle navigation"]')).toBeNull();
  });
});
