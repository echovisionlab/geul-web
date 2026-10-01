// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { create } from '@bufbuild/protobuf';
import {
  ParagraphBlockSchema,
  ParagraphBlockLocaleSchema,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicLegalPageInitialData } from '@/lib/queries/legal-public-page';
import { PrivacyPageClient } from '@/app/(general)/privacy/PrivacyPageClient';
import { TermsPageClient } from '@/app/(general)/terms/TermsPageClient';

const mocks = vi.hoisted(() => ({
  query: new URLSearchParams(),
  getPage: vi.fn(),
  getActive: vi.fn(),
  getScheduled: vi.fn(),
  getPreview: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useSearchParams: () => mocks.query }));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/lib/queries/privacy-browser', () => ({
  getPrivacyPageData: mocks.getPage,
  getActivePrivacy: mocks.getActive,
  getScheduledPrivacy: mocks.getScheduled,
  getScheduledPrivacyPreview: mocks.getPreview,
}));
vi.mock('@/lib/queries/terms-browser', () => ({
  getTermsPageData: mocks.getPage,
  getActiveTerms: mocks.getActive,
  getScheduledTerms: mocks.getScheduled,
  getScheduledTermsPreview: mocks.getPreview,
}));
vi.mock('@/features/date-time/DateTime', () => ({
  useDateTimeFormatter: () => ({ date: (date: Date) => date.toISOString() }),
}));
vi.mock('@/features/navigation/TableOfContents', () => ({ TableOfContents: () => null }));
vi.mock('@/features/policy/LegalTranslationNotice', () => ({ LegalTranslationNotice: () => null }));
vi.mock('@/features/translation/ContentLanguageMenu', () => ({ ContentLanguageMenu: () => null }));
vi.mock('@/features/print/PrintButton', () => ({ PrintButton: () => <button type="button">Print</button> }));
vi.mock('@/features/site/PageLoader', () => ({ PageLoader: () => <span data-testid="loader">Loading</span> }));

function snapshot(): PublicLegalPageInitialData {
  return {
    requestedLocale: 'en',
    updatedAt: Date.now(),
    data: {
      active: {
        id: 'active-version',
        version: 1,
        title: 'Policy',
        content: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            kind: 'paragraph',
            base: create(ParagraphBlockSchema),
            locale: create(ParagraphBlockLocaleSchema, {
              content: [{ value: { case: 'text', value: { text: 'Published legal document' } } }],
            }),
            children: [],
          },
        ],
        localizationInfo: null,
        status: 'active',
        effectiveFrom: new Date('2026-10-01T00:00:00Z'),
        createdAt: null,
      },
      scheduled: null,
    },
  };
}

function screen(kind: 'privacy' | 'terms', initialData?: PublicLegalPageInitialData, client = new QueryClient()) {
  const Page = kind === 'privacy' ? PrivacyPageClient : TermsPageClient;
  return (
    <QueryClientProvider client={client}>
      <MantineProvider>
        <Page initialData={initialData} />
      </MantineProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query = new URLSearchParams();
  mocks.getPage.mockResolvedValue(snapshot().data);
  mocks.getActive.mockResolvedValue(snapshot().data.active);
  mocks.getScheduled.mockResolvedValue(null);
  mocks.getPreview.mockResolvedValue(null);
});

describe.each(['privacy', 'terms'] as const)('%s initial public document', (kind) => {
  it('includes the published body in the first server render', () => {
    const html = renderToStaticMarkup(screen(kind, snapshot()));
    expect(html).toContain('Published legal document');
    expect(html).not.toContain('data-testid="loader"');
  });

  it('renders an authoritative empty response without a loader', () => {
    const initialData = snapshot();
    initialData.data.active = null;
    const html = renderToStaticMarkup(screen(kind, initialData));
    expect(html).toContain('emptyTitle');
    expect(html).not.toContain('data-testid="loader"');
  });

  it('does not reuse another locale or a public snapshot for a ShareLink preview', () => {
    mocks.query = new URLSearchParams('lang=ko');
    expect(renderToStaticMarkup(screen(kind, snapshot()))).toContain('data-testid="loader"');
    mocks.query = new URLSearchParams('preview=scheduled-id&token=share-token');
    expect(renderToStaticMarkup(screen(kind, snapshot()))).toContain('data-testid="loader"');
  });

  it('mounts fresh server data without issuing another browser query', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } });
    try {
      await act(async () => {
        root.render(screen(kind, snapshot(), client));
      });
      expect(
        mocks.getPage.mock.calls.length + mocks.getActive.mock.calls.length + mocks.getScheduled.mock.calls.length,
      ).toBe(0);
      expect(container.textContent).toContain('Published legal document');
    } finally {
      act(() => root.unmount());
      client.clear();
    }
  });

  it('hydrates the server body without replacing it or fetching it again', async () => {
    const initialData = snapshot();
    const serverClient = new QueryClient();
    const browserClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } });
    const container = document.createElement('div');
    container.innerHTML = renderToString(screen(kind, initialData, serverClient));
    const serverBody = container.querySelector(`.${kind}-content`);
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, screen(kind, initialData, browserClient), { onRecoverableError });
      });
      expect(serverBody).not.toBeNull();
      expect(container.querySelector(`.${kind}-content`)).toBe(serverBody);
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(mocks.getPage).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      serverClient.clear();
      browserClient.clear();
    }
  });

  it('uses the new server version when a return visit has older browser data', async () => {
    const initialData = snapshot();
    const olderData = snapshot();
    olderData.data.active!.version = 0;
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } });
    client.setQueryData([kind, 'page', 'en'], olderData.data, { updatedAt: initialData.updatedAt - 1_000 });
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      await act(async () => root.render(screen(kind, initialData, client)));
      expect(container.textContent).toContain('version 1');
      expect(container.textContent).not.toContain('version 0');
      expect(mocks.getPage).not.toHaveBeenCalled();
    } finally {
      act(() => root.unmount());
      client.clear();
    }
  });

  it('shows fresh server content while a pre-existing browser request is still pending', async () => {
    const initialData = snapshot();
    const pending = Promise.withResolvers<typeof initialData.data>();
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } });
    const request = client.fetchQuery({ queryKey: [kind, 'page', 'en'], queryFn: () => pending.promise });
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      await act(async () => root.render(screen(kind, initialData, client)));
      expect(container.textContent).toContain('Published legal document');
      expect(container.querySelector('[data-testid="loader"]')).toBeNull();
    } finally {
      pending.resolve(initialData.data);
      await act(async () => {
        await request;
        root.unmount();
      });
      client.clear();
    }
  });

  it('shows a query failure separately from an unpublished policy', async () => {
    mocks.getPage.mockRejectedValue(new Error('Network unavailable'));
    const container = document.createElement('div');
    const root = createRoot(container);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    try {
      await act(async () => {
        root.render(screen(kind, undefined, client));
      });
      await act(async () => {
        await vi.waitFor(() => expect(container.textContent).toContain('failedToLoad'));
      });
      expect(container.textContent).not.toContain('emptyTitle');
    } finally {
      act(() => root.unmount());
      client.clear();
    }
  });

  it('renders the scheduled notice on the first server render', () => {
    const initialData = snapshot();
    initialData.data.scheduled = {
      id: 'next-version',
      version: 2,
      title: 'Next policy',
      localizationInfo: null,
      status: 'scheduled',
      effectiveFrom: new Date('2026-11-01T00:00:00Z'),
    };
    expect(renderToStaticMarkup(screen(kind, initialData))).toContain('active.upcomingAlert');
  });

  it('fetches one combined snapshot when server data is unavailable', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } });
    try {
      await act(async () => root.render(screen(kind, undefined, client)));
      expect(mocks.getPage).toHaveBeenCalledExactlyOnceWith('en');
      expect(mocks.getActive).not.toHaveBeenCalled();
      expect(mocks.getScheduled).not.toHaveBeenCalled();
    } finally {
      act(() => root.unmount());
      client.clear();
    }
  });
});
