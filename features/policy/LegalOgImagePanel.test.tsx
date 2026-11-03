// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor } from '@/test/render';
import type { OgGenerationRunSignal } from '@/lib/types/og-generation';
import { LegalOgImagePanel } from './LegalOgImagePanel';

const mocks = vi.hoisted(() => ({
  getLegalOgImageAction: vi.fn(),
  regenerateLegalOgImageAction: vi.fn(),
  trackGeneration: vi.fn(),
  trackLatest: vi.fn(),
  trackRequestedGeneration: vi.fn(),
  useOgImage: vi.fn(),
}));

let queryClient: QueryClient;

vi.mock('@/components/core/Notification', () => ({ notifications: { show: vi.fn() } }));

vi.mock('@/features/metadata/OgImagePreview', () => ({
  OgImagePreview: ({
    src,
    generationStatus,
    generationError,
    onRegenerate,
  }: {
    src?: string;
    generationStatus?: string;
    generationError?: string;
    onRegenerate?: () => void;
  }) => (
    <button
      data-src={src ?? ''}
      data-status={generationStatus ?? ''}
      data-error={generationError ?? ''}
      onClick={onRegenerate}
      type="button"
    >
      Regenerate OG image
    </button>
  ),
}));

vi.mock('@/features/site/SiteOgBackgroundUploader/SiteOgBackgroundUploader', () => ({
  SiteOgBackgroundUploader: ({ onSuccess }: { onSuccess?: (runId?: string) => void }) => (
    <button onClick={() => onSuccess?.('background-run')} type="button">
      Change background
    </button>
  ),
}));

vi.mock('@/lib/actions/site-setting', () => ({
  getLegalOgImageAction: (...args: unknown[]) => mocks.getLegalOgImageAction(...args),
  regenerateLegalOgImageAction: (...args: unknown[]) => mocks.regenerateLegalOgImageAction(...args),
}));

vi.mock('@/lib/hooks/useOgImage', () => ({
  useOgImage: (...args: unknown[]) => mocks.useOgImage(...args),
}));

beforeEach(() => {
  mocks.getLegalOgImageAction.mockResolvedValue({
    data: { assetId: 'asset-old', url: 'https://cdn.example.test/asset/asset-old/og.webp' },
  });
  mocks.regenerateLegalOgImageAction.mockResolvedValue({
    success: true,
    runId: 'run-1',
    generationId: 'generation-1',
  });
  mocks.useOgImage.mockReturnValue({
    src: 'https://cdn.example.test/asset/asset-old/og.webp',
    status: 'processing',
    error: undefined,
    isRegenerating: true,
    trackGeneration: mocks.trackGeneration,
    trackLatest: mocks.trackLatest,
    trackRequestedGeneration: mocks.trackRequestedGeneration,
    targetKey: 'privacy:ko',
  });
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

afterEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
});

function renderPanel(
  entityType: 'privacy' | 'terms' = 'privacy',
  translationGenerationRun?: OgGenerationRunSignal,
  locale = 'ko',
  sourceTitleGeneration?: { locale: string; sequence: number },
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <LegalOgImagePanel
        entityType={entityType}
        locale={locale}
        currentBackgroundUrl={null}
        sourceTitleGeneration={sourceTitleGeneration}
        translationGenerationRun={translationGenerationRun}
      />
    </QueryClientProvider>,
    { locale: 'en' },
  );
}

describe('LegalOgImagePanel', () => {
  it('tracks the concrete legal locale target and renders server status', async () => {
    renderPanel('privacy');
    const preview = await screen.findByRole('button', { name: 'Regenerate OG image' });

    expect(mocks.useOgImage).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'privacy',
        entityId: '00000000-0000-0000-0000-000000000101',
        locale: 'ko',
        provider: null,
      }),
    );
    expect(preview).toHaveAttribute('data-status', 'processing');
  });

  it('tracks the generation returned by a manual retry', async () => {
    const { user } = renderPanel('terms');
    await user.click(await screen.findByRole('button', { name: 'Regenerate OG image' }));

    expect(mocks.regenerateLegalOgImageAction).toHaveBeenCalledWith('terms', 'ko');
    await waitFor(() => expect(mocks.trackRequestedGeneration).toHaveBeenCalledWith('generation-1', 'privacy:ko'));
  });

  it('locates the latest generation after an automatic background change', async () => {
    const { user } = renderPanel('privacy');
    await screen.findByRole('button', { name: 'Regenerate OG image' });
    await user.click(screen.getByRole('button', { name: 'Change background' }));

    expect(mocks.trackLatest).toHaveBeenCalledTimes(1);
  });

  it('uses the active content locale instead of the UI locale', async () => {
    const { user } = renderPanel('privacy', { runId: 'translation-run-ja', locale: 'ja', sequence: 1 }, 'ja');
    const preview = await screen.findByRole('button', { name: 'Regenerate OG image' });

    expect(mocks.getLegalOgImageAction).toHaveBeenCalledWith('privacy', 'ja');
    expect(mocks.useOgImage).toHaveBeenCalledWith(expect.objectContaining({ locale: 'ja' }));
    expect(mocks.trackLatest).toHaveBeenCalledTimes(1);

    await user.click(preview);
    await waitFor(() => expect(mocks.regenerateLegalOgImageAction).toHaveBeenCalledWith('privacy', 'ja'));
  });

  it('recovers a source-title generation even when its lifecycle event was missed', async () => {
    renderPanel('privacy', undefined, 'ko', { locale: 'ko', sequence: 1 });
    await screen.findByRole('button', { name: 'Regenerate OG image' });

    expect(mocks.trackLatest).toHaveBeenCalledTimes(1);
  });

  it('refetches the canonical legal asset when a generation becomes ready', async () => {
    const { rerender } = renderPanel('privacy', undefined, 'ko');
    await screen.findByRole('button', { name: 'Regenerate OG image' });
    expect(mocks.getLegalOgImageAction).toHaveBeenCalledTimes(1);

    mocks.useOgImage.mockReturnValue({
      src: 'https://cdn.example.test/asset/new/og.webp',
      status: 'ready',
      readyGenerationId: 'ready-generation',
      error: undefined,
      isRegenerating: false,
      trackGeneration: mocks.trackGeneration,
      trackLatest: mocks.trackLatest,
      trackRequestedGeneration: mocks.trackRequestedGeneration,
      targetKey: 'privacy:ko',
    });
    rerender(
      <QueryClientProvider client={queryClient}>
        <LegalOgImagePanel entityType="privacy" locale="ko" currentBackgroundUrl={null} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mocks.getLegalOgImageAction).toHaveBeenCalledTimes(2));
  });
});
