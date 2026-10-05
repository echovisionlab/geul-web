import { Code, ConnectError } from '@connectrpc/connect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requestId: 0,
  gets: Array.from({ length: 6 }, () => vi.fn()),
  creates: Array.from({ length: 6 }, () => vi.fn()),
}));
vi.mock('react', () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => {
    const values = new Map<string, ReturnType<T>>();
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify([mocks.requestId, ...args]);
      if (!values.has(key)) {
        values.set(key, fn(...args) as ReturnType<T>);
      }
      return values.get(key);
    }) as T;
  },
}));
vi.mock('@/lib/api/server-client', () => ({
  createManifestClient: async () => ({
    get: async () => ({
      settings: { siteTitle: 'Studio', siteOrigin: 'https://example.test', socialLinks: {} },
      menus: { header: [] },
    }),
  }),
  createPublicManifestClient: vi.fn(),
  createPublicArtistClientWithAuth: mocks.creates[0],
  createPublicLabelClientWithAuth: mocks.creates[1],
  createPublicReleaseClientWithAuth: mocks.creates[2],
  createPublicSeriesClientWithAuth: mocks.creates[3],
  createPublicProgramEventClientWithAuth: mocks.creates[4],
  createPublicProgramEventSeriesClientWithAuth: mocks.creates[5],
  createPublicFormClientWithAuth: vi.fn(),
  createPublicPageClient: vi.fn(),
  createPublicPageClientWithAuth: vi.fn(),
  createPublicPostClientWithAuth: vi.fn(),
  createPublicMemberClient: vi.fn(),
  createPublicWorkClientWithAuth: vi.fn(),
}));
vi.mock('@/lib/queries/taxonomy', () => ({ getPublicCategoryBySlug: vi.fn(), getPublicTagBySlug: vi.fn() }));
const domains = ['artist', 'label', 'release', 'series', 'event', 'event-series'] as const;
const expectedCalls = 1;
function response(index: number, locale = 'en') {
  const key = index === 5 ? 'series' : domains[index];
  return {
    [key]: {
      id: `${key}-1`,
      slug: 'entry',
      name: 'Name',
      title: 'Title',
      status: 2,
      artists: [],
      labels: [],
      categories: [],
      clients: [],
      credits: [],
      socialLinks: {},
      localizationInfo: {
        requestedLocale: locale,
        displayedLocale: locale,
        sourceLocale: 'ko',
        availableLocales: ['en', 'ko'],
      },
    },
    blockMedia: [],
  };
}
beforeEach(() => {
  vi.resetModules();
  mocks.requestId += 1;
  mocks.gets.forEach((get, index) => {
    get.mockReset();
    get.mockResolvedValue(response(index));
    mocks.creates[index].mockReset();
    mocks.creates[index].mockResolvedValue({
      get,
      getWorks: async () => ({ works: [] }),
      getReleases: async () => ({ releases: [] }),
    });
  });
});
afterEach(() => vi.useRealTimers());
async function readers(index: number) {
  if (index === 0) {
    const { getArtistView } = await import('./artist');
    const { getArtistMetadataDocument } = await import('./metadata');
    return {
      body: (locale = 'en', source = false, token?: string, password?: string) =>
        getArtistView('entry', {
          requestedLocale: locale,
          preferSourceLocale: source,
          shareToken: token,
          sharePassword: password,
        }),
      metadata: (locale = 'en', source = false) =>
        getArtistMetadataDocument('entry', { requestedLocale: locale, preferSourceLocale: source }),
    };
  }
  if (index === 1) {
    const { getLabelPublic } = await import('./label');
    const { getLabelMetadataDocument } = await import('./metadata');
    return {
      body: (locale = 'en', source = false, token?: string, password?: string) =>
        getLabelPublic('entry', token, {
          requestedLocale: locale,
          preferSourceLocale: source,
          sharePassword: password,
        }),
      metadata: (locale = 'en', source = false) =>
        getLabelMetadataDocument('entry', { requestedLocale: locale, preferSourceLocale: source }),
    };
  }
  if (index === 2) {
    const { getReleasePublic } = await import('./release');
    const { getReleaseMetadataDocument } = await import('./metadata');
    return {
      body: (locale = 'en', source = false, token?: string, password?: string) =>
        getReleasePublic('entry', token, {
          requestedLocale: locale,
          preferSourceLocale: source,
          sharePassword: password,
        }),
      metadata: (locale = 'en', source = false) =>
        getReleaseMetadataDocument('entry', { requestedLocale: locale, preferSourceLocale: source }),
    };
  }
  if (index === 3) {
    const { getPublicSeries } = await import('./series');
    return {
      body: (locale = 'en') => getPublicSeries('entry', { requestedLocale: locale }),
      metadata: (locale = 'en') => getPublicSeries('entry', { requestedLocale: locale }),
    };
  }
  const { getProgramEventView, getProgramEventSeriesView } = await import('./program-event');
  if (index === 4) {
    return {
      body: (locale = 'en', source = false) =>
        getProgramEventView('entry', { requestedLocale: locale, preferSourceLocale: source }),
      metadata: (locale = 'en', source = false) =>
        getProgramEventView('entry', { requestedLocale: locale, preferSourceLocale: source }),
    };
  }
  return { body: () => getProgramEventSeriesView('entry'), metadata: () => getProgramEventSeriesView('entry') };
}
for (const [index, domain] of domains.entries()) {
  describe(`${domain} detail reuse`, () => {
    it('shares metadata and body with identical mappings', async () => {
      const r = await readers(index);
      const [body, metadata] = await Promise.all([r.body(), r.metadata()]);
      expect(body).toMatchObject({ id: `${index === 5 ? 'series' : domain}-1` });
      expect(metadata).toMatchObject({ id: `${index === 5 ? 'series' : domain}-1` });
      expect(mocks.gets[index]).toHaveBeenCalledTimes(expectedCalls);
    });
    it('measures the same serial 50ms transport fixture', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(0);
      mocks.gets[index].mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(response(index)), 50)),
      );
      const r = await readers(index);
      const start = Date.now();
      const first = r.metadata();
      await vi.runAllTimersAsync();
      await first;
      const second = r.body();
      await vi.runAllTimersAsync();
      await second;
      expect(mocks.gets[index]).toHaveBeenCalledTimes(expectedCalls);
      expect(Date.now() - start).toBe(expectedCalls * 50);
    });
  });
}

for (const [index, domain] of domains.entries()) {
  describe(`${domain} isolation and failures`, () => {
    it('refreshes after request scope changes', async () => {
      const r = await readers(index);
      await r.body();
      mocks.requestId += 1;
      await r.metadata();
      expect(mocks.gets[index]).toHaveBeenCalledTimes(2);
    });
    if (index !== 5) {
      it('isolates locale while normalizing whitespace', async () => {
        const r = await readers(index);
        await r.body(' en ');
        await r.metadata('en');
        await r.body('ko');
        expect(mocks.gets[index]).toHaveBeenCalledTimes(2);
        expect(mocks.creates[index]).toHaveBeenCalledWith('en');
        expect(mocks.creates[index]).toHaveBeenCalledWith('ko');
      });
    }
    if (index <= 2 || index === 4) {
      it('shares original-language fallback responses per locale', async () => {
        mocks.creates[index].mockImplementation(async (locale: string) => ({
          get: async (input: unknown) => {
            mocks.gets[index](input);
            return response(index, locale);
          },
          getWorks: async () => ({ works: [] }),
          getReleases: async () => ({ releases: [] }),
        }));
        const r = await readers(index);
        const [body, metadata] = await Promise.all([r.body('en', true), r.metadata('en', true)]);
        expect(body).toMatchObject({ localizationInfo: { displayedLocale: 'ko' } });
        expect(metadata).toMatchObject({ localizationInfo: { displayedLocale: 'ko' } });
        expect(mocks.gets[index]).toHaveBeenCalledTimes(2);
      });
    }
    it('retains missing entity semantics', async () => {
      mocks.gets[index].mockRejectedValue(new ConnectError('missing', Code.NotFound));
      const r = await readers(index);
      expect(await r.body()).toBeNull();
      expect(await r.metadata()).toBeNull();
      expect(mocks.gets[index]).toHaveBeenCalledTimes(1);
    });
    if (index <= 2) {
      it('keeps token and password reads outside the ordinary response cache', async () => {
        const r = await readers(index);
        await r.body();
        await r.body('en', false, 'secret', 'password');
        await r.body('en', false, 'secret', 'password');
        await r.metadata();
        expect(mocks.gets[index]).toHaveBeenCalledTimes(3);
        expect(mocks.gets[index]).toHaveBeenNthCalledWith(2, {
          slug: 'entry',
          shareToken: 'secret',
          sharePassword: 'password',
        });
      });
      it('keeps password-only reads outside the ordinary response cache', async () => {
        const r = await readers(index);
        await r.body('en', false, undefined, 'password');
        await r.body('en', false, undefined, 'password');
        expect(mocks.gets[index]).toHaveBeenCalledTimes(2);
      });
    }
  });
}
it('preserves null optional-auth locale and decoded slug helper keys', async () => {
  const { getPublicArtistResponse } = await import('./detail-public.server');
  await Promise.all([getPublicArtistResponse('한 글'), getPublicArtistResponse('한 글', ' ')]);
  expect(mocks.creates[0]).toHaveBeenCalledWith(null);
  expect(mocks.gets[0]).toHaveBeenCalledTimes(1);
  expect(mocks.gets[0]).toHaveBeenCalledWith({ slug: '한 글' });
});

it('decodes valid Label slugs but preserves malformed body forwarding', async () => {
  const { getLabelPublic } = await import('./label');
  const { getLabelMetadataDocument } = await import('./metadata');
  await Promise.all([
    getLabelPublic('hello%20world', undefined, { requestedLocale: 'en' }),
    getLabelMetadataDocument('hello%20world', { requestedLocale: 'en' }),
  ]);
  expect(mocks.gets[1]).toHaveBeenCalledTimes(1);
  expect(mocks.gets[1]).toHaveBeenCalledWith({ slug: 'hello world' });
  await getLabelPublic('%broken', undefined, { requestedLocale: 'en' });
  expect(mocks.gets[1]).toHaveBeenLastCalledWith({ slug: '%broken' });
  expect(await getLabelMetadataDocument('%broken', { requestedLocale: 'en' })).toBeNull();
  expect(mocks.gets[1]).toHaveBeenCalledTimes(2);
});
