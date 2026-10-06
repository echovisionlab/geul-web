import { Suspense, type ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import type { PageMetadataDocument } from '@/lib/queries/metadata';
import { renderToReadableStream } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicPageView from './page';
import { PageContent } from './PageContent';
import { PageJsonLd } from './PageJsonLd';

const mocks = vi.hoisted(() => ({ getPageView: vi.fn(), getPageMetadataDocument: vi.fn() }));
vi.mock('@/lib/queries/page', () => ({
  getPage: vi.fn(),
  getPageView: mocks.getPageView,
  getPageAccessView: async (...args: unknown[]) => {
    const page = await mocks.getPageView(...args);
    return page ? { reason: 'allowed', page } : null;
  },
}));
vi.mock('@/lib/queries/metadata', () => ({
  getPageMetadataDocument: mocks.getPageMetadataDocument,
  getSiteMetadataDocument: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not-found');
  },
  redirect: vi.fn(),
}));
vi.mock('@/lib/utils/language.server', () => ({ getUserLocale: async () => 'en' }));
vi.mock('@/lib/utils/session.server', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({ createTranslationClient: vi.fn() }));
vi.mock('@/lib/queries/manifest', () => ({ getManageSiteContext: vi.fn() }));
vi.mock('@/lib/utils/url.server', () => ({ getBaseUrl: vi.fn() }));
vi.mock('@/features/page/PageEditor/LazyPageEditor', () => ({ LazyPageEditor: () => null }));
vi.mock('./PageContentWithToken', () => ({ PageContentWithToken: () => null }));
// Printing is an unrelated client control; retain the real body, layout, renderer, and media providers.
vi.mock('@/features/print/PrintButton', () => ({ PrintButton: () => null }));

const page = {
  title: 'Authorized visible page',
  showTitle: true,
  content: [],
  blockMedia: [],
  documentLayout: { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' },
};
const metadataDocument: PageMetadataDocument = {
  kind: 'page',
  id: 'page-1',
  title: page.title,
  showTitle: true,
  summary: null,
  routePath: '/some/where',
  slug: 'some/where',
  featuredImageUrl: null,
  ogImageUrl: null,
  createdAt: null,
  updatedAt: null,
  publishedAt: null,
  site: {
    siteTitle: 'Site',
    siteDescription: null,
    canonicalOrigin: 'https://example.test',
    siteOgImageUrl: null,
    companyName: null,
    logoUrl: null,
    socialLinks: [],
  },
};
const props = () => ({
  params: Promise.resolve({ slug: ['some', 'where'] }),
  searchParams: Promise.resolve({ lang: 'ko' }),
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
async function LegacyPage() {
  await mocks.getPageMetadataDocument('some/where', { requestedLocale: 'ko' });
  return <PageContent slug="some/where" requestedLocale="ko" />;
}
async function start(element: ReactNode) {
  const stream = await renderToReadableStream(
    <html lang="ko">
      <head />
      <body>
        <MantineProvider>
          <Suspense fallback={<span>outer pending</span>}>{element}</Suspense>
        </MantineProvider>
      </body>
    </html>,
  );
  return { stream, reader: stream.getReader(), decoder: new TextDecoder() };
}

describe('authorized page body streaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPageView.mockResolvedValue(page);
    mocks.getPageMetadataDocument.mockResolvedValue(null);
  });

  it('streams the real body while JSON-LD metadata is still pending, unlike the prior dependency', async () => {
    const metadata = deferred<PageMetadataDocument>();
    mocks.getPageMetadataDocument.mockReturnValue(metadata.promise);
    const legacy = await start(<LegacyPage />);
    const oldChunk = legacy.decoder.decode((await legacy.reader.read()).value);
    expect(oldChunk).not.toContain(page.title);
    expect(mocks.getPageView).not.toHaveBeenCalled();

    const result = await PublicPageView(props());
    const current = await start(result);
    let chunk = current.decoder.decode((await current.reader.read()).value);
    while (!chunk.includes(page.title)) {
      const next = await current.reader.read();
      if (next.done) {
        break;
      }
      chunk += current.decoder.decode(next.value);
    }
    expect(chunk).toContain(page.title);
    expect(chunk).toContain('page-content');
    expect(chunk).not.toContain('application/ld+json');
    expect(mocks.getPageView).toHaveBeenCalledExactlyOnceWith('some/where', { requestedLocale: 'ko' });
    expect(mocks.getPageMetadataDocument).toHaveBeenLastCalledWith('some/where', { requestedLocale: 'ko' });
    metadata.resolve(metadataDocument);
    let tail = '';
    for (;;) {
      const next = await current.reader.read();
      if (next.done) {
        break;
      }
      tail += current.decoder.decode(next.value);
    }
    expect(tail).toContain('application/ld+json');
    expect(tail).toContain('https://example.test/some/where');
    await Promise.all([legacy.stream.allReady, current.stream.allReady]);
    await legacy.reader.cancel();
    await current.reader.cancel();
  });

  it('measures the controlled 50 ms page / 500 ms metadata dependency', async () => {
    async function measure(legacy: boolean) {
      const started = performance.now();
      const readyPage = new Promise((resolve) => setTimeout(() => resolve(page), 50));
      const readyMetadata = new Promise((resolve) => setTimeout(() => resolve(null), 500));
      mocks.getPageView.mockReturnValue(readyPage);
      mocks.getPageMetadataDocument.mockReturnValue(readyMetadata);
      const output = await start(legacy ? <LegacyPage /> : await PublicPageView(props()));
      let html = '';
      while (!html.includes(page.title)) {
        const next = await output.reader.read();
        if (next.done) {
          break;
        }
        html += output.decoder.decode(next.value);
      }
      expect(html).toContain(page.title);
      const bodyMs = performance.now() - started;
      await output.stream.allReady;
      await output.reader.cancel();
      return bodyMs;
    }
    const beforeMs = await measure(true);
    const afterMs = await measure(false);
    process.stdout.write(
      `Artificial controlled stream body readiness: before=${beforeMs.toFixed(1)}ms after=${afterMs.toFixed(1)}ms\n`,
    );
    expect(beforeMs).toBeGreaterThanOrEqual(490);
    expect(afterMs).toBeLessThan(350);
  });

  it('rejects absent pages before returning body or starting JSON-LD', async () => {
    mocks.getPageView.mockResolvedValue(null);
    await expect(PublicPageView(props())).rejects.toThrow('not-found');
    expect(mocks.getPageMetadataDocument).not.toHaveBeenCalled();
  });

  it('propagates authoritative lookup errors before metadata rendering', async () => {
    mocks.getPageView.mockRejectedValue(new Error('permission-denied'));
    await expect(PublicPageView(props())).rejects.toThrow('permission-denied');
    expect(mocks.getPageMetadataDocument).not.toHaveBeenCalled();
  });

  it('keeps standalone PageContent lookup and notFound behavior', async () => {
    await PageContent({ slug: 'direct', requestedLocale: 'en' });
    expect(mocks.getPageView).toHaveBeenCalledWith('direct', { requestedLocale: 'en' });
    mocks.getPageView.mockResolvedValue(null);
    await expect(PageContent({ slug: 'missing', requestedLocale: 'en' })).rejects.toThrow('not-found');
  });

  it('preserves JSON-LD lookup errors rather than swallowing them', async () => {
    mocks.getPageMetadataDocument.mockRejectedValue(new Error('metadata-failed'));
    await expect(PageJsonLd({ slug: 'direct', requestedLocale: 'en' })).rejects.toThrow('metadata-failed');
  });
});
