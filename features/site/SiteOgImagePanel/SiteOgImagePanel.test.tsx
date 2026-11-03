// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import { SITE_OG_TARGET_ID } from '@/lib/og-generation-targets';
import { SiteOgImagePanel } from './SiteOgImagePanel';
const actions = vi.hoisted(() => ({
  status: vi.fn(),
  regenerate: vi.fn(),
  latest: vi.fn(),
  generation: vi.fn(),
  remove: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: actions.refresh }) }));
vi.mock('@/lib/actions/site-setting', () => ({
  getSiteOgStatusAction: actions.status,
  regenerateSiteOgImageAction: actions.regenerate,
  deleteSiteAssetAction: actions.remove,
  setSiteAssetAction: vi.fn(),
}));
vi.mock('@/lib/hooks/useUpload', () => ({ useUpload: () => ({ upload: vi.fn(), isUploading: false }) }));
const clients: QueryClient[] = [];
const read = { latest: actions.latest, generation: actions.generation };
beforeEach(() => {
  actions.status.mockReset().mockResolvedValue({ data: { assetId: 'site-asset', url: '/site.webp' } });
  actions.regenerate.mockReset().mockResolvedValue({ success: true, generationId: 'manual-generation' });
  actions.latest.mockReset().mockResolvedValue({ generation: null });
  actions.generation.mockReset().mockResolvedValue({
    generation: {
      generationId: 'manual-generation',
      runId: 'manual-run',
      status: 'ready',
      assetUrl: '/new-site.webp',
    },
  });
  actions.remove.mockReset().mockResolvedValue({ success: true });
});
afterEach(() => clients.splice(0).forEach((client) => client.clear()));
function setup(props: Partial<Parameters<typeof SiteOgImagePanel>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <SiteOgImagePanel
          currentBackgroundUrl={null}
          bindings={{
            status: actions.status,
            regenerate: actions.regenerate,
            read,
            asset: { set: vi.fn(), remove: actions.remove, upload: vi.fn(), uploadFile: vi.fn() },
          }}
          {...props}
        />
      </QueryClientProvider>,
    ),
  };
}
describe('SiteOgImagePanel', () => {
  it.each([true, false])('distinguishes the initial wait from a resolved OG preview (image=%s)', async (hasImage) => {
    let finish!: (result: { data: { assetId: string | null; url?: string } }) => void;
    actions.status.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    setup();
    expect(screen.getAllByRole('status', { name: 'Loading...' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('No OG image')).not.toBeInTheDocument();
    await act(async () =>
      finish({ data: hasImage ? { assetId: 'site-asset', url: '/site.webp' } : { assetId: null } }),
    );
    if (hasImage) {
      expect(await screen.findByRole('img', { name: 'Open Graph preview' })).toHaveAttribute(
        'src',
        expect.stringContaining('site.webp'),
      );
    } else {
      expect(await screen.findByText('No OG image')).toBeInTheDocument();
    }
  });
  it.each(['transport', 'action'])(
    'shows a recoverable %s status failure instead of an empty preview',
    async (failure) => {
      if (failure === 'transport') {
        actions.status.mockRejectedValueOnce(new Error('Status unavailable'));
      } else {
        actions.status.mockResolvedValueOnce({ error: 'Status unavailable' });
      }
      const { user } = setup();
      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.queryByText('No OG image')).not.toBeInTheDocument();
      actions.status.mockResolvedValue({ data: { assetId: 'site-asset', url: '/site.webp' } });
      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByRole('img', { name: 'Open Graph preview' })).toBeInTheDocument();
    },
  );
  it('retains the resolved preview when a background status refresh fails', async () => {
    const { client } = setup();
    await screen.findByRole('img', { name: 'Open Graph preview' });
    actions.status.mockRejectedValue(new Error('Status unavailable'));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['siteOgStatus'] });
    });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Open Graph preview' })).toBeInTheDocument();
  });

  it('uses the fixed providerless target and polls manual generations before refetching the canonical asset', async () => {
    const { user } = setup();
    await screen.findByRole('img', { name: 'Open Graph preview' });
    expect(actions.latest).toHaveBeenCalledWith({ entityType: 'site', entityId: SITE_OG_TARGET_ID, locale: undefined });
    await user.click(screen.getByRole('button', { name: 'Regenerate OG Image' }));
    await waitFor(() => expect(actions.generation).toHaveBeenCalledWith('manual-generation'));
    await waitFor(() => expect(actions.status.mock.calls.length).toBeGreaterThan(1));
  });
  it.each([undefined, 'site-run'])(
    'discovers a background generation only when its mutation returns a run (%s)',
    async (runId) => {
      actions.remove.mockResolvedValue({ success: true, ogGenerationRunId: runId });
      const { user } = setup({ currentBackgroundUrl: '/background.webp' });
      await screen.findByRole('img', { name: 'Open Graph preview' });
      await waitFor(() => expect(actions.latest).toHaveBeenCalled());
      const initialLookups = actions.latest.mock.calls.length;
      await user.click(await screen.findByRole('button', { name: 'Remove featured image' }));
      await waitFor(() => expect(actions.remove).toHaveBeenCalled());
      await waitFor(() => expect(actions.status.mock.calls.length).toBeGreaterThan(1));
      expect(actions.latest.mock.calls.length).toBe(initialLookups + (runId ? 1 : 0));
    },
  );
  it('discovers an automatic generation returned by the settings owner', async () => {
    setup({ automaticGenerationRunId: 'settings-run' });
    await waitFor(() => expect(actions.latest).toHaveBeenCalledTimes(2));
  });
});
