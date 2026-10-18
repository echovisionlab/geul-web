// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { navigatePreview } from '../shared/preview-navigation';
import { MailAdaptersPreview } from './MailAdapters.stories';
import { CampaignAnalyticsPreview } from './CampaignAnalytics.stories';
import { OgImageSettingsPreview } from './OgImageSettings.stories';
import { waitInAct } from '@/test/act-wait';

// Full production page renders: a loaded CI worker needs more than the default 5s per test.
vi.setConfig({ testTimeout: 20_000 });
vi.mock('../shared/preview-navigation', () => ({ navigatePreview: vi.fn(() => true) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/preview',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'local-campaign' }),
}));
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  vi.useRealTimers();
  act(() => root?.unmount());
  host?.remove();
  vi.restoreAllMocks();
});
async function render(node: ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<TestProviders>{node}</TestProviders>));
}
function button(text: string) {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text));
}
describe('complete production page preview controllers', () => {
  beforeEach(() => vi.mocked(navigatePreview).mockClear());
  it('shows a failed OG preview response as a retryable error instead of indefinite loading', async () => {
    const fetchPreview = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
    await render(<OgImageSettingsPreview />);
    // The preview request waits for its 500ms input debounce before it can fail.
    await waitInAct(() => {
      expect(button('Try again')).toBeDefined();
      expect(host.textContent).toContain('Something went wrong');
    }, 8000);
    expect(host.textContent).not.toContain('Generating preview');
    const requests = fetchPreview.mock.calls.length;
    await act(async () => button('Try again')!.click());
    await waitInAct(() => expect(fetchPreview.mock.calls.length).toBeGreaterThan(requests));
  });
  it('reports adapter read failure as an error rather than an empty adapter list', async () => {
    await render(<MailAdaptersPreview state="failed" />);
    await waitInAct(() => expect(host.querySelector('[role=alert]')).not.toBeNull());
    expect(host.textContent).not.toContain('No adapters configured');
    expect(host.querySelector('[role=switch]')).toBeNull();
  });
  it('persists an adapter switch update after the real query invalidation/refetch', async () => {
    await render(<MailAdaptersPreview />);
    await waitInAct(() => expect(host.querySelector('input[role=switch]')).not.toBeNull());
    const control = host.querySelector<HTMLInputElement>('input[role=switch]')!;
    expect(control.checked).toBe(true);
    await act(async () => control.click());
    await waitInAct(() => expect(host.querySelector<HTMLInputElement>('input[role=switch]')!.checked).toBe(false));
    expect(host.textContent).toContain('Local logging');
  });
  it('loads the next recipient page through the actual analytics pagination', async () => {
    await render(<CampaignAnalyticsPreview />);
    await waitInAct(() => expect(host.textContent).toContain('listener-1@example.com'));
    const next = host.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!;
    expect(next).not.toBeNull();
    await act(async () => next.click());
    await waitInAct(() => expect(host.textContent).toContain('listener-51@example.com'));
    expect(host.textContent).not.toContain('listener-1@example.com');
  });
});
