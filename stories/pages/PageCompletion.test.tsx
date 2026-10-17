// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { navigatePreview } from '../shared/preview-navigation';
import { MailAdaptersPreview } from './MailAdapters.stories';
import { CampaignAnalyticsPreview } from './CampaignAnalytics.stories';
import { CommunicationListsPreview } from './AdminCommunicationLists.stories';
import { AdminUserEditPreview } from './AdminUserEdit.stories';
import { OgImageSettingsPreview } from './OgImageSettings.stories';
import { ProgramEventListsPreview } from './ProgramEventLists.stories';
import { waitInAct } from '@/test/act-wait';
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
function rows() {
  return host.querySelectorAll('tbody tr').length;
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
    }, 3000);
    expect(host.textContent).not.toContain('Generating preview');
    const requests = fetchPreview.mock.calls.length;
    await act(async () => button('Try again')!.click());
    await waitInAct(() => expect(fetchPreview.mock.calls.length).toBeGreaterThan(requests));
  });
  it('renders member profile and security owners with the required session context', async () => {
    await render(<AdminUserEditPreview />);
    await waitInAct(() => expect(host.querySelector('input[value="June Han"]')).not.toBeNull());
    expect(host.textContent).toContain('Connected SSO providers');
    expect(host.textContent).toContain('Personal access token');
    const nickname = host.querySelector<HTMLInputElement>('input[value="June Han"]')!;
    vi.useFakeTimers();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(nickname, 'June Local');
      nickname.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // The availability check is debounced by 350ms.
    await act(async () => vi.advanceTimersByTimeAsync(350));
    vi.useRealTimers();
    expect(host.textContent).toContain('This nickname is available.');
    await act(async () => button('Save')!.click());
    await waitInAct(() => expect(host.querySelector('h1')?.textContent).toBe('June Local'));
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
  it.each(['forms', 'campaigns'] as const)(
    'creates a local %s through the original production controller',
    async (domain) => {
      await render(<CommunicationListsPreview domain={domain} />);
      await waitInAct(() => expect(rows()).toBeGreaterThan(0));
      const before = rows();
      const create = button('New')!;
      expect(create).toBeDefined();
      await act(async () => create.click());
      await waitInAct(() => expect(rows()).toBe(before + 1));
      expect(navigatePreview).toHaveBeenCalledOnce();
    },
  );
  it('creates a programme event through its actual production button', async () => {
    await render(<ProgramEventListsPreview />);
    await waitInAct(() => expect(rows()).toBeGreaterThan(0));
    const before = rows();
    const create = button('New')!;
    expect(create).toBeDefined();
    await act(async () => create.click());
    await waitInAct(() => expect(rows()).toBe(before + 1));
    expect(navigatePreview).toHaveBeenCalledOnce();
  });
});
