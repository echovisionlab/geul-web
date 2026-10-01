import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicLegalPageInitialData } from '@/lib/queries/legal-public-page';

const mocks = vi.hoisted(() => ({ presentation: vi.fn() }));
vi.mock('@/features/policy/public-legal-page.server', () => ({
  getPublicLegalPagePresentation: mocks.presentation,
}));
vi.mock('@/lib/utils/language.server', () => ({ getUserLocale: async () => 'en' }));
function Client({ initialData }: { initialData?: PublicLegalPageInitialData }) {
  return initialData ? (
    <article data-locale={initialData.requestedLocale}>{initialData.data.active?.title}</article>
  ) : (
    <span data-testid="client-fetch" />
  );
}
vi.mock('@/app/(general)/privacy/PrivacyPageClient', () => ({ PrivacyPageClient: Client }));
vi.mock('@/app/(general)/terms/TermsPageClient', () => ({ TermsPageClient: Client }));

import * as privacy from '@/app/(general)/privacy/page';
import * as terms from '@/app/(general)/terms/page';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.presentation.mockResolvedValue({
    site: {
      siteTitle: 'Studio',
      siteDescription: null,
      canonicalOrigin: 'https://example.com',
      siteOgImageUrl: null,
      companyName: null,
      logoUrl: null,
      socialLinks: [],
    },
    title: 'Published version',
    description: 'Published body summary',
    snapshot: {
      policy: { title: 'Published version' },
      data: {
        active: {
          id: 'v1',
          version: 1,
          title: 'Published version',
          content: [],
          status: 'active',
          localizationInfo: null,
          effectiveFrom: null,
          createdAt: null,
        },
        scheduled: null,
      },
      updatedAt: Date.now(),
    },
  });
});

describe.each([
  { kind: 'privacy', route: privacy },
  { kind: 'terms', route: terms },
])('$kind server route', ({ kind, route }) => {
  it('passes the selected locale and server version to metadata and the initial body', async () => {
    const props = { searchParams: Promise.resolve({ lang: 'ko' }) };
    const metadata = await route.generateMetadata(props);
    const html = renderToStaticMarkup(await route.default(props));
    expect(mocks.presentation).toHaveBeenCalledWith(kind, 'ko');
    expect(metadata.title).toBe('Published version');
    expect(html).toContain('data-locale="ko"');
    expect(html).toContain('Published version');
    expect(html).toContain('Published body summary');
  });

  it('keeps ShareLink previews client-owned and excludes their token from metadata', async () => {
    const props = { searchParams: Promise.resolve({ preview: 'scheduled-v2', token: 'private-token' }) };
    const metadata = await route.generateMetadata(props);
    const html = renderToStaticMarkup(await route.default(props));
    expect(metadata.robots).toMatchObject({ index: false });
    expect(metadata.referrer).toBe('no-referrer');
    expect(JSON.stringify(metadata)).not.toContain('private-token');
    expect(mocks.presentation).not.toHaveBeenCalled();
    expect(html).toContain('data-testid="client-fetch"');
    expect(html).not.toContain('Published version');
  });

  it('leaves a failed server read available for a browser retry', async () => {
    const presentation = await mocks.presentation();
    mocks.presentation.mockResolvedValue({ ...presentation, snapshot: null });
    const html = renderToStaticMarkup(await route.default({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('data-testid="client-fetch"');
    expect(html).not.toContain('data-locale=');
  });
});
