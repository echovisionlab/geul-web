// @vitest-environment jsdom

import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { SITE_OG_TARGET_ID } from '@/lib/og-generation-targets';
import { SiteOgImagePanel } from './SiteOgImagePanel';

const mocks = vi.hoisted(() => ({
  getSiteOgStatusAction: vi.fn(),
  regenerateSiteOgImageAction: vi.fn(),
  trackGeneration: vi.fn(),
  trackLatest: vi.fn(),
  useOgImage: vi.fn(),
}));

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let queryClient: QueryClient | null = null;

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));
vi.mock('@/components/core/MediaPreviewGrid', () => ({
  MediaPreviewGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/metadata/OgImagePreview', () => ({
  OgImagePreview: ({ onRegenerate }: { onRegenerate?: () => void }) => (
    <button data-testid="regenerate" onClick={onRegenerate} type="button" />
  ),
}));
vi.mock('@/features/site/SiteOgBackgroundUploader/SiteOgBackgroundUploader', () => ({
  SiteOgBackgroundUploader: ({ onSuccess }: { onSuccess?: (runId?: string) => void }) => (
    <div>
      <button data-testid="background-with-run" onClick={() => onSuccess?.('site-run')} type="button" />
      <button data-testid="background-without-run" onClick={() => onSuccess?.()} type="button" />
    </div>
  ),
}));
vi.mock('@/lib/actions/site-setting', () => ({
  getSiteOgStatusAction: (...args: unknown[]) => mocks.getSiteOgStatusAction(...args),
  regenerateSiteOgImageAction: (...args: unknown[]) => mocks.regenerateSiteOgImageAction(...args),
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
  mocks.getSiteOgStatusAction.mockResolvedValue({
    data: { assetId: 'site-asset', url: 'https://cdn.example.test/site.webp' },
  });
  mocks.regenerateSiteOgImageAction.mockResolvedValue({
    success: true,
    runId: 'manual-run',
    generationId: 'manual-generation',
  });
  mocks.useOgImage.mockReturnValue({
    src: 'https://cdn.example.test/site.webp',
    status: 'ready',
    isRegenerating: false,
    trackGeneration: mocks.trackGeneration,
    trackLatest: mocks.trackLatest,
  });
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <MantineProvider>
          <SiteOgImagePanel currentBackgroundUrl={null} />
        </MantineProvider>
      </QueryClientProvider>,
    );
  });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  queryClient?.clear();
  container = null;
  root = null;
  queryClient = null;
  vi.clearAllMocks();
});

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('SiteOgImagePanel', () => {
  it('uses the fixed providerless Site target and tracks a manual generation directly', async () => {
    await flush();
    expect(mocks.useOgImage).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'site',
        entityId: SITE_OG_TARGET_ID,
        provider: null,
      }),
    );

    await act(async () => {
      (container?.querySelector('[data-testid="regenerate"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(mocks.trackGeneration).toHaveBeenCalledWith('manual-generation');
  });

  it('starts polling only when an automatic background update created a run', async () => {
    await flush();
    act(() => {
      (container?.querySelector('[data-testid="background-without-run"]') as HTMLButtonElement).click();
    });
    expect(mocks.trackLatest).not.toHaveBeenCalled();

    act(() => {
      (container?.querySelector('[data-testid="background-with-run"]') as HTMLButtonElement).click();
    });
    expect(mocks.trackLatest).toHaveBeenCalledTimes(1);
  });

  it('starts providerless polling when a Site setting or light-logo run is returned', async () => {
    await flush();
    act(() => {
      root?.render(
        <QueryClientProvider client={queryClient!}>
          <MantineProvider>
            <SiteOgImagePanel currentBackgroundUrl={null} automaticGenerationRunId="settings-run" />
          </MantineProvider>
        </QueryClientProvider>,
      );
    });
    await flush();

    expect(mocks.trackLatest).toHaveBeenCalledTimes(1);
  });

  it('refetches the canonical Site asset when a generation becomes ready', async () => {
    await flush();
    expect(mocks.getSiteOgStatusAction).toHaveBeenCalledTimes(1);

    mocks.useOgImage.mockReturnValue({
      src: 'https://cdn.example.test/new-site.webp',
      status: 'ready',
      readyGenerationId: 'ready-generation',
      isRegenerating: false,
      trackGeneration: mocks.trackGeneration,
      trackLatest: mocks.trackLatest,
    });
    act(() => {
      root?.render(
        <QueryClientProvider client={queryClient!}>
          <MantineProvider>
            <SiteOgImagePanel currentBackgroundUrl={null} />
          </MantineProvider>
        </QueryClientProvider>,
      );
    });
    await flush();

    expect(mocks.getSiteOgStatusAction).toHaveBeenCalledTimes(2);
  });
});
