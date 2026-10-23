// @vitest-environment jsdom
// @geul-test-pool forks: the OG preview failure never renders under vmThreads (fake/real timer hand-off)
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@/test/render';
import MailAdaptersPage from '@/features/admin/mail-adapter/MailAdaptersPage';
import { mailAdaptersFixture } from './fixtures/mail-adapters';
import { MailAdaptersPreview } from './MailAdapters.stories';
import { CampaignAnalyticsPreview } from './CampaignAnalytics.stories';
import { OgImageSettingsPreview } from './OgImageSettings.stories';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/preview',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'local-campaign' }),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('production preview controllers', () => {
  it('shows a failed OG preview response as a retryable error instead of indefinite loading', async () => {
    const fetchPreview = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
    vi.useFakeTimers();
    const view = render(<OgImageSettingsPreview />);
    await act(() => vi.advanceTimersByTimeAsync(500));
    vi.useRealTimers();
    const home = await screen.findByRole('form', { name: 'OG Image Settings Homepage' });
    const retry = await within(home).findByRole('button', { name: 'Try again' });
    expect(within(home).getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.queryByText('Generating preview')).not.toBeInTheDocument();
    const requests = fetchPreview.mock.calls.length;
    await view.user.click(retry);
    await waitFor(() => expect(fetchPreview.mock.calls.length).toBeGreaterThan(requests));
  });

  it('reports adapter read failure as an error rather than an empty adapter list', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={client}>
        <MailAdaptersPage bindings={mailAdaptersFixture('failed')} />
      </QueryClientProvider>,
    );
    try {
      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.queryByText('No adapters configured')).not.toBeInTheDocument();
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    } finally {
      view.unmount();
      client.clear();
    }
  });

  it('persists an adapter switch update after the real query invalidation/refetch', async () => {
    const { user } = render(<MailAdaptersPreview />);
    const control = await screen.findByRole('switch', { name: /Local logging/ });
    expect(control).toBeChecked();
    await user.click(control);
    await waitFor(() => expect(control).not.toBeChecked());
    expect(screen.getByText('Local logging', { exact: true })).toBeInTheDocument();
  });

  it('loads the next recipient page through the actual analytics pagination', async () => {
    const { user } = render(<CampaignAnalyticsPreview />);
    expect(await screen.findByText('listener-1@example.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('listener-51@example.com')).toBeInTheDocument();
    expect(screen.queryByText('listener-1@example.com')).not.toBeInTheDocument();
  });
});
