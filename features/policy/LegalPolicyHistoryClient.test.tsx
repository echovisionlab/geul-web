// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act, type ReactNode } from 'react';
import { create } from '@bufbuild/protobuf';
import {
  ParagraphBlockSchema,
  ParagraphBlockLocaleSchema,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderSettledServerHtml } from '@/test/settled-server-render';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LegalPolicyHistoryClient } from './LegalPolicyHistoryClient';
import { PrivacyHistoryDetailClient } from '@/app/(general)/privacy/history/[id]/PrivacyHistoryDetailClient';
import { TermsHistoryDetailClient } from '@/app/(general)/terms/history/[id]/TermsHistoryDetailClient';
import type { PublicLegalHistoryDetailInitialData } from '@/lib/queries/legal-history';

const mocks = vi.hoisted(() => ({ get: vi.fn(), query: new URLSearchParams('lang=ko') }));
const serverLoads = vi.hoisted(() => ({ pending: [] as Promise<unknown>[] }));
vi.mock('next/dynamic', async () => {
  const { default: dynamic } = await vi.importActual<typeof import('next/dist/shared/lib/app-dynamic.js')>(
    'next/dist/shared/lib/app-dynamic.js',
  );
  const { trackServerLoader } = await import('@/test/settled-server-render');
  return {
    default: function trackedDynamic<P = object>(
      loader: import('next/dist/shared/lib/app-dynamic.js').Loader<P>,
      options?: import('next/dist/shared/lib/app-dynamic.js').DynamicOptions<P>,
    ) {
      return dynamic(trackServerLoader(loader, serverLoads.pending), options);
    },
  };
});
vi.mock('next/navigation', () => ({ useSearchParams: () => mocks.query }));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => Object.assign((key: string) => key, { rich: () => 'Current version' }),
}));
vi.mock('@/lib/queries/privacy-browser', () => ({ getArchivedPrivacy: mocks.get }));
vi.mock('@/lib/queries/terms-browser', () => ({ getArchivedTerms: mocks.get }));
vi.mock('@/features/date-time/DateTime', () => ({
  useDateTimeFormatter: () => ({ date: (date: Date) => date.toISOString() }),
}));
vi.mock('@/features/policy/LegalTranslationNotice', () => ({ LegalTranslationNotice: () => null }));
vi.mock('@/features/translation/ContentLanguageMenu', () => ({ ContentLanguageMenu: () => null }));
vi.mock('@/features/navigation/TableOfContents', () => ({
  // The navigation owner wraps the document so Core can reserve the outline beside it.
  TableOfContents: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/features/print/PrintButton', () => ({ PrintButton: () => null }));
vi.mock('@/features/site/PageLoader', () => ({ PageLoader: () => <span>Loading policy</span> }));

const labels = {
  title: 'History',
  back: 'Back',
  noVersions: 'No versions',
  version: 'Version',
  status: 'Status',
  current: 'Current',
  archived: 'Archived',
  effectivePeriod: 'Period',
  notAvailable: 'N/A',
  openDateRange: (date: string) => date,
  closedDateRange: (from: string, until: string) => `${from}/${until}`,
};
let root: Root | undefined;
let container: HTMLDivElement | undefined;
afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = undefined;
  vi.clearAllMocks();
});

function wrapper(content: ReactNode, client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <DesignSystemProvider forceColorScheme="light">{content}</DesignSystemProvider>
    </QueryClientProvider>
  );
}
async function ssrAndHydrate(content: ReactNode, client: QueryClient) {
  const html = await renderSettledServerHtml(wrapper(content, client), serverLoads.pending);
  container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  await act(async () => {
    root = hydrateRoot(container!, wrapper(content, client));
  });
  return html;
}

describe('legal history server snapshots', () => {
  it('measures the unseeded history baseline: loader in SSR and two hydration queries', async () => {
    const getActive = vi.fn().mockResolvedValue({ id: 'current', version: 3, effectiveFrom: null });
    const listArchived = vi.fn().mockResolvedValue([{ id: 'old', version: 2, effectiveFrom: null }]);
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60000, retry: false } } });
    const html = await ssrAndHydrate(
      <LegalPolicyHistoryClient
        policy="privacy"
        labels={labels}
        requestedLocale="ko"
        getActive={getActive}
        listArchived={listArchived}
      />,
      client,
    );
    expect(html).toContain('Loading policy');
    expect(getActive).toHaveBeenCalledExactlyOnceWith('ko');
    expect(listArchived).toHaveBeenCalledTimes(1);
  });
  it('renders history links before hydration and hydrates without RPCs', async () => {
    const getActive = vi.fn();
    const listArchived = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60000, retry: false } } });
    const html = await ssrAndHydrate(
      <LegalPolicyHistoryClient
        policy="privacy"
        labels={labels}
        requestedLocale="ko"
        getActive={getActive}
        listArchived={listArchived}
        initialData={{
          requestedLocale: 'ko',
          updatedAt: Date.now(),
          active: { id: 'current', version: 3, effectiveFrom: null },
          archived: [{ id: 'old', version: 2, effectiveFrom: null }],
        }}
      />,
      client,
    );
    expect(html).toContain('v<!-- -->3');
    expect(html).toContain('v<!-- -->2');
    expect(html).not.toContain('Loading policy');
    const links = container!.querySelectorAll('tbody a');
    expect(Array.from(links, (link) => link.getAttribute('href'))).toEqual([
      '/privacy?lang=ko',
      '/privacy/history/old?lang=ko',
    ]);
    expect(container!.querySelector('tbody > a')).toBeNull();
    expect(container!.querySelector('h1')).toHaveTextContent('History');
    expect(container!.querySelector('h1')).toHaveAttribute('data-level', '2');
    expect(container!.querySelector('table')).toHaveAttribute('aria-label', 'History');
    expect(container!.querySelectorAll('thead th[scope="col"]')).toHaveLength(3);
    const statusCells = [...container!.querySelectorAll('tbody tr')].map((row) => row.children[1]);
    expect(statusCells.map((cell) => cell?.textContent)).toEqual(['Current', 'Archived']);
    for (const cell of statusCells) {
      expect(cell?.querySelector('[data-core-typography="text"]')).toHaveAttribute('data-size', 'sm');
    }
    expect(getActive).not.toHaveBeenCalled();
    expect(listArchived).not.toHaveBeenCalled();
  });
  it.each([PrivacyHistoryDetailClient, TermsHistoryDetailClient])(
    'uses a fresh server detail over stale browser data and hydrates without fetching',
    async (Component) => {
      const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60000, retry: false } } });
      const kind = Component === PrivacyHistoryDetailClient ? 'privacy' : 'terms';
      client.setQueryData(
        [kind, 'archived', 'old', 'ko'],
        { id: 'old', version: 1, content: null, status: 'active' },
        { updatedAt: Date.now() - 10000 },
      );
      const initialData: PublicLegalHistoryDetailInitialData = {
        id: 'old',
        requestedLocale: 'ko',
        updatedAt: Date.now(),
        data: {
          id: 'old',
          version: 4,
          title: 'Legal',
          content: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              kind: 'paragraph',
              base: create(ParagraphBlockSchema),
              locale: create(ParagraphBlockLocaleSchema, {
                content: [{ value: { case: 'text', value: { text: 'Archived legal document body' } } }],
              }),
              children: [],
            },
          ],
          localizationInfo: null,
          status: 'archived',
          effectiveFrom: null,
          effectiveUntil: null,
          createdAt: null,
        },
      };
      const html = await ssrAndHydrate(<Component id="old" initialData={initialData} />, client);
      expect(html).toContain('version<!-- --> <!-- -->4');
      expect(container!.textContent).toContain('archived');
      expect(html).toContain('Archived legal document body');
      expect(container!.textContent).toContain('Archived legal document body');
      expect(html).not.toContain('Loading policy');
      expect(mocks.get).not.toHaveBeenCalled();
    },
  );
  it('renders an authoritative missing version without a loader or another request', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60000, retry: false } } });
    const html = await ssrAndHydrate(
      <PrivacyHistoryDetailClient
        id="missing"
        initialData={{ id: 'missing', requestedLocale: 'ko', updatedAt: Date.now(), data: null }}
      />,
      client,
    );
    expect(html).toContain('notFound');
    expect(html).not.toContain('Loading policy');
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it('does not reuse a snapshot in another language', async () => {
    mocks.get.mockResolvedValue(null);
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60000, retry: false } } });
    const html = await ssrAndHydrate(
      <PrivacyHistoryDetailClient
        id="missing"
        initialData={{ id: 'missing', requestedLocale: 'en', updatedAt: Date.now(), data: null }}
      />,
      client,
    );
    expect(html).toContain('Loading policy');
    expect(mocks.get).toHaveBeenCalledWith('missing', 'ko');
  });
});
