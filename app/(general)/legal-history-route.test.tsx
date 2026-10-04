import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }));
vi.mock('@/lib/queries/legal-history.server', () => ({
  getPublicLegalHistory: mocks.list,
  getPublicLegalHistoryDetail: mocks.detail,
}));
vi.mock('@/lib/utils/language.server', () => ({ getUserLocale: async () => 'en' }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@/lib/queries/metadata', () => ({
  getSiteMetadataDocument: async () => ({
    siteTitle: 'Studio',
    canonicalOrigin: 'https://example.com',
    siteDescription: null,
    siteOgImageUrl: null,
    companyName: null,
    logoUrl: null,
    socialLinks: [],
  }),
}));
function Client({ initialData }: { initialData?: { requestedLocale: string } }) {
  return (
    <article data-locale={initialData?.requestedLocale}>{initialData ? 'Seeded history' : 'Browser recovery'}</article>
  );
}
vi.mock('./privacy/history/PrivacyHistoryClient', () => ({ PrivacyHistoryClient: Client }));
vi.mock('./terms/history/TermsHistoryClient', () => ({ TermsHistoryClient: Client }));
vi.mock('./privacy/history/[id]/PrivacyHistoryDetailClient', () => ({ PrivacyHistoryDetailClient: Client }));
vi.mock('./terms/history/[id]/TermsHistoryDetailClient', () => ({ TermsHistoryDetailClient: Client }));
import PrivacyHistoryPage from './privacy/history/page';
import TermsHistoryPage from './terms/history/page';
import PrivacyHistoryDetailPage from './privacy/history/[id]/page';
import TermsHistoryDetailPage from './terms/history/[id]/page';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({ requestedLocale: 'ko' });
  mocks.detail.mockResolvedValue({ requestedLocale: 'ko' });
});
describe.each([
  { kind: 'privacy', list: PrivacyHistoryPage, detail: PrivacyHistoryDetailPage },
  { kind: 'terms', list: TermsHistoryPage, detail: TermsHistoryDetailPage },
])('$kind public history route', ({ kind, list, detail }) => {
  it('passes localized server snapshots into list and exact-version body', async () => {
    const props = { searchParams: Promise.resolve({ lang: 'ko' }), params: Promise.resolve({ id: 'old' }) };
    const listHtml = renderToStaticMarkup(await list(props));
    const detailHtml = renderToStaticMarkup(await detail(props));
    expect(mocks.list).toHaveBeenCalledExactlyOnceWith(kind, 'ko');
    expect(mocks.detail).toHaveBeenCalledExactlyOnceWith(kind, 'old', 'ko');
    expect(listHtml).toContain('data-locale="ko"');
    expect(detailHtml).toContain('data-locale="ko"');
  });
  it('keeps browser recovery available after a transient server failure', async () => {
    mocks.list.mockRejectedValue(new Error('Transient'));
    mocks.detail.mockRejectedValue(new Error('Transient'));
    const props = { searchParams: Promise.resolve({}), params: Promise.resolve({ id: 'old' }) };
    expect(renderToStaticMarkup(await list(props))).toContain('Browser recovery');
    expect(renderToStaticMarkup(await detail(props))).toContain('Browser recovery');
    expect(mocks.list).toHaveBeenCalledWith(kind, 'en');
    expect(mocks.detail).toHaveBeenCalledWith(kind, 'old', 'en');
  });
});
