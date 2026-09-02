// @vitest-environment jsdom

import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
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

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let queryClient: QueryClient | null = null;

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

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
      data-testid="og-preview"
      data-src={src ?? ''}
      data-status={generationStatus ?? ''}
      data-error={generationError ?? ''}
      onClick={onRegenerate}
      type="button"
    />
  ),
}));

vi.mock('@/features/site/SiteOgBackgroundUploader/SiteOgBackgroundUploader', () => ({
  SiteOgBackgroundUploader: ({ onSuccess }: { onSuccess?: (runId?: string) => void }) => (
    <button data-testid="background-success" onClick={() => onSuccess?.('background-run')} type="button" />
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
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
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
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  queryClient?.clear();
  queryClient = null;
  vi.clearAllMocks();
});

function renderPanel(
  entityType: 'privacy' | 'terms' = 'privacy',
  translationGenerationRun?: OgGenerationRunSignal,
  locale = 'ko',
  sourceTitleGeneration?: { locale: string; sequence: number },
) {
  if (!queryClient) {
    throw new Error('queryClient missing');
  }
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <MantineProvider>
          <LegalOgImagePanel
            entityType={entityType}
            locale={locale}
            currentBackgroundUrl={null}
            sourceTitleGeneration={sourceTitleGeneration}
            translationGenerationRun={translationGenerationRun}
          />
        </MantineProvider>
      </QueryClientProvider>,
    );
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('LegalOgImagePanel', () => {
  it('tracks the concrete legal locale target and renders server status', async () => {
    renderPanel('privacy');
    await flush();

    expect(mocks.useOgImage).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'privacy',
        entityId: '00000000-0000-0000-0000-000000000101',
        locale: 'ko',
        provider: null,
      }),
    );
    const preview = container?.querySelector('[data-testid="og-preview"]');
    expect(preview?.getAttribute('data-status')).toBe('processing');
  });

  it('tracks the generation returned by a manual retry', async () => {
    renderPanel('terms');
    await flush();
    await act(async () => {
      (container?.querySelector('[data-testid="og-preview"]') as HTMLButtonElement).click();
    });

    expect(mocks.regenerateLegalOgImageAction).toHaveBeenCalledWith('terms', 'ko');
    expect(mocks.trackRequestedGeneration).toHaveBeenCalledWith('generation-1', 'privacy:ko');
  });

  it('locates the latest generation after an automatic background change', async () => {
    renderPanel('privacy');
    await flush();
    act(() => {
      (container?.querySelector('[data-testid="background-success"]') as HTMLButtonElement).click();
    });

    expect(mocks.trackLatest).toHaveBeenCalledTimes(1);
  });

  it('starts polling after a translated legal title creates a run', async () => {
    renderPanel('privacy', { runId: 'translation-run', locale: 'ko', sequence: 1 });
    await flush();
    expect(mocks.trackLatest).toHaveBeenCalledTimes(1);
  });

  it('uses the active content locale instead of the UI locale', async () => {
    renderPanel('privacy', { runId: 'translation-run-ja', locale: 'ja', sequence: 1 }, 'ja');
    await flush();

    expect(mocks.getLegalOgImageAction).toHaveBeenCalledWith('privacy', 'ja');
    expect(mocks.useOgImage).toHaveBeenCalledWith(expect.objectContaining({ locale: 'ja' }));
    expect(mocks.trackLatest).toHaveBeenCalledTimes(1);

    await act(async () => {
      (container?.querySelector('[data-testid="og-preview"]') as HTMLButtonElement).click();
    });
    expect(mocks.regenerateLegalOgImageAction).toHaveBeenCalledWith('privacy', 'ja');
  });

  it('recovers a source-title generation even when its lifecycle event was missed', async () => {
    renderPanel('privacy', undefined, 'ko', { locale: 'ko', sequence: 1 });
    await flush();

    expect(mocks.trackLatest).toHaveBeenCalledTimes(1);
  });

  it('refetches the canonical legal asset when a generation becomes ready', async () => {
    renderPanel('privacy', undefined, 'ko');
    await flush();
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
    act(() => {
      root?.render(
        <QueryClientProvider client={queryClient!}>
          <MantineProvider>
            <LegalOgImagePanel entityType="privacy" locale="ko" currentBackgroundUrl={null} />
          </MantineProvider>
        </QueryClientProvider>,
      );
    });
    await flush();

    expect(mocks.getLegalOgImageAction).toHaveBeenCalledTimes(2);
  });
});
