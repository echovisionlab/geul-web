// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { AccountLifecyclePagePreview } from './AccountLifecycle.stories';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/preview',
}));
vi.mock('@/lib/actions/account', () => ({ requestAccountRecoveryFormAction: vi.fn() }));
vi.mock('@/lib/actions/newsletter', () => ({ unsubscribeNewsletterAction: vi.fn() }));
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
async function render(view: React.ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<TestProviders>{view}</TestProviders>));
}
describe('actual account lifecycle page states', () => {
  it('submits the actual recovery request action and shows its safe email notice', async () => {
    await render(<AccountLifecyclePagePreview />);
    const input = await vi.waitFor(() => {
      const field = host.querySelector<HTMLInputElement>('input[name=email]');
      expect(field).not.toBeNull();
      return field!;
    });
    input.value = 'june@example.com';
    await act(async () => {
      host
        .querySelector<HTMLFormElement>('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(host.textContent).toContain('Check Your Email');
    expect(host.textContent).not.toContain('june@example.com');
  });
});
