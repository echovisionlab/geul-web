import { Code, ConnectError } from '@connectrpc/connect';
import { PostStatus } from '@echovisionlab/geul-proto/public/post_pb.ts';
import { WorkStatus } from '@echovisionlab/geul-proto/public/work_pb.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requestId: 0,
  postGet: vi.fn(),
  workGet: vi.fn(),
  manifestGet: vi.fn(),
  createPost: vi.fn(),
  createWork: vi.fn(),
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
  createManifestClient: async () => ({ get: mocks.manifestGet }),
  createPublicManifestClient: vi.fn(),
  createPublicArtistClientWithAuth: vi.fn(),
  createPublicFormClientWithAuth: vi.fn(),
  createPublicLabelClientWithAuth: vi.fn(),
  createPublicPageClient: vi.fn(),
  createPublicPageClientWithAuth: vi.fn(),
  createPublicPostClientWithAuth: mocks.createPost,
  createPublicPostClient: vi.fn(),
  createPostClient: vi.fn(),
  createPublicReleaseClientWithAuth: vi.fn(),
  createPublicMemberClient: vi.fn(),
  createPublicWorkClientWithAuth: mocks.createWork,
  createPublicWorkClient: vi.fn(),
  createWorkClient: vi.fn(),
}));
vi.mock('@/lib/queries/taxonomy', () => ({ getPublicCategoryBySlug: vi.fn(), getPublicTagBySlug: vi.fn() }));

const expectedGetCalls = 1;
const postResponse = () => ({
  post: { id: 'post-1', slug: 'entry', title: 'Post title', status: PostStatus.PUBLISHED },
  blockMedia: [],
});
const workResponse = () => ({
  work: { id: 'work-1', slug: 'entry', title: 'Work title', status: WorkStatus.PUBLISHED },
  blockMedia: [],
});

function entityResponse(domain: 'post' | 'work') {
  return domain === 'post' ? postResponse().post : workResponse().work;
}

beforeEach(() => {
  vi.resetModules();
  mocks.requestId += 1;
  mocks.postGet.mockReset();
  mocks.workGet.mockReset();
  mocks.createPost.mockReset();
  mocks.createWork.mockReset();
  mocks.createPost.mockResolvedValue({ get: mocks.postGet });
  mocks.createWork.mockResolvedValue({ get: mocks.workGet });
  mocks.postGet.mockResolvedValue(postResponse());
  mocks.workGet.mockResolvedValue(workResponse());
  mocks.manifestGet.mockResolvedValue({
    settings: { siteTitle: 'Studio', siteOrigin: 'https://studio.example.test', socialLinks: {} },
    menus: { header: [] },
  });
});
afterEach(() => {
  vi.useRealTimers();
});

async function readers() {
  const { getPostView, getPostViewWithToken } = await import('./post');
  const { getWorkView, getWorkViewWithShareToken } = await import('./work');
  const { getPostMetadataDocument, getWorkMetadataDocument } = await import('./metadata');
  return {
    getPostView,
    getPostViewWithToken,
    getWorkView,
    getWorkViewWithShareToken,
    getPostMetadataDocument,
    getWorkMetadataDocument,
  };
}

describe('ordinary Post and Work raw response request reuse', () => {
  it('shares the concurrent Post metadata/body read while preserving both mappings', async () => {
    const r = await readers();
    const [body, metadata] = await Promise.all([
      r.getPostView('entry', { requestedLocale: 'en' }),
      r.getPostMetadataDocument('entry', { requestedLocale: 'en' }),
    ]);
    expect(body).toMatchObject({ id: 'post-1', title: 'Post title', status: 'published', blockMedia: [] });
    expect(metadata).toMatchObject({ id: 'post-1', title: 'Post title', routePath: '/posts/entry', kind: 'post' });
    expect(mocks.postGet).toHaveBeenCalledTimes(expectedGetCalls);
  });

  it('eliminates the second serial Work delay under the same 50ms artificial transport', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    mocks.workGet.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(workResponse()), 50)));
    const r = await readers();
    const started = Date.now();
    const metadataPromise = r.getWorkMetadataDocument('entry', { requestedLocale: 'en' });
    await vi.runAllTimersAsync();
    expect(await metadataPromise).toMatchObject({ title: 'Work title', routePath: '/works/entry', kind: 'work' });
    const bodyPromise = r.getWorkView('entry', { requestedLocale: 'en' });
    await vi.runAllTimersAsync();
    expect(await bodyPromise).toMatchObject({ title: 'Work title', status: 'published', blockMedia: [] });
    expect(mocks.workGet).toHaveBeenCalledTimes(expectedGetCalls);
    expect(Date.now() - started).toBe(expectedGetCalls * 50);
  });
});

for (const domain of ['post', 'work'] as const) {
  describe(`${domain} request isolation and reader contracts`, () => {
    async function domainReaders() {
      const r = await readers();
      return domain === 'post'
        ? {
            view: r.getPostView,
            metadata: r.getPostMetadataDocument,
            get: mocks.postGet,
            create: mocks.createPost,
            share: r.getPostViewWithToken,
            response: postResponse,
          }
        : {
            view: r.getWorkView,
            metadata: r.getWorkMetadataDocument,
            get: mocks.workGet,
            create: mocks.createWork,
            share: r.getWorkViewWithShareToken,
            response: workResponse,
          };
    }

    it('shares equivalent decoded slug/locale keys and still uses optional auth for no locale', async () => {
      const r = await domainReaders();
      await Promise.all([r.view('ent%72y'), r.metadata('entry', { requestedLocale: ' ' })]);
      expect(r.get).toHaveBeenCalledTimes(1);
      expect(r.get).toHaveBeenCalledWith({ slug: 'entry' });
      expect(r.create).toHaveBeenCalledWith(null);
      await Promise.all([r.view('entry', { requestedLocale: ' en ' }), r.metadata('entry', { requestedLocale: 'en' })]);
      expect(r.get).toHaveBeenCalledTimes(2);
      expect(r.create).toHaveBeenLastCalledWith('en');
    });

    it('does not pool locales or responses from different React requests', async () => {
      const r = await domainReaders();
      await Promise.all([r.view('entry', { requestedLocale: 'en' }), r.view('entry', { requestedLocale: 'ko' })]);
      expect(r.get).toHaveBeenCalledTimes(2);
      mocks.requestId += 1;
      const response = { [domain]: { ...entityResponse(domain), title: 'Updated title' }, blockMedia: [] };
      r.get.mockResolvedValue(response);
      expect(await r.view('entry', { requestedLocale: 'en' })).toMatchObject({ title: 'Updated title' });
      expect(r.get).toHaveBeenCalledTimes(3);
    });

    it('shares source-locale fallback without mixing the requested-language response', async () => {
      const r = await domainReaders();
      r.create.mockImplementation(async (locale) => ({ get: (input: unknown) => r.get(input, locale) }));
      r.get.mockImplementation(async (_input, locale) => ({
        [domain]: {
          ...entityResponse(domain),
          title: locale === 'ko' ? 'Source title' : 'Translated title',
          localizationInfo: {
            sourceLocale: 'ko',
            displayedLocale: locale,
            requestedLocale: locale,
            availableLocales: ['en', 'ko'],
          },
        },
        blockMedia: [],
      }));
      const [body, metadata] = await Promise.all([
        r.view('entry', { requestedLocale: 'en', preferSourceLocale: true }),
        r.metadata('entry', { requestedLocale: 'en', preferSourceLocale: true }),
      ]);
      expect(body).toMatchObject({ title: 'Source title' });
      expect(metadata).toMatchObject({ title: 'Source title' });
      expect(r.get).toHaveBeenCalledTimes(2);
      expect(await r.view('entry', { requestedLocale: 'en' })).toMatchObject({ title: 'Translated title' });
      expect(r.get).toHaveBeenCalledTimes(2);
    });

    it('keeps token/password reads separate and uncached', async () => {
      const r = await domainReaders();
      await r.view('entry', { requestedLocale: 'en' });
      await r.share('entry', 'token-a', 'en', 'password-a');
      await r.share('entry', 'token-b', 'en', 'password-b');
      await r.share('entry', 'token-a', 'en', 'password-a');
      await r.metadata('entry', { requestedLocale: 'en' });
      expect(r.get).toHaveBeenCalledTimes(4);
      expect(r.get.mock.calls.map((call) => call[0])).toEqual([
        { slug: 'entry' },
        { slug: 'entry', shareToken: 'token-a', sharePassword: 'password-a' },
        { slug: 'entry', shareToken: 'token-b', sharePassword: 'password-b' },
        { slug: 'entry', shareToken: 'token-a', sharePassword: 'password-a' },
      ]);
    });

    it('preserves distinct metadata/view visibility mappings for draft and archived responses', async () => {
      const r = await domainReaders();
      r.get.mockResolvedValue({
        [domain]: {
          ...entityResponse(domain),
          status: domain === 'post' ? PostStatus.DRAFT : WorkStatus.DRAFT,
        },
        blockMedia: [],
      });
      expect(await r.view('entry', { requestedLocale: 'en' })).toMatchObject({ status: 'draft' });
      expect(await r.metadata('entry', { requestedLocale: 'en' })).toBeNull();
      expect(r.get).toHaveBeenCalledTimes(1);
      mocks.requestId += 1;
      r.get.mockResolvedValue({
        [domain]: {
          ...entityResponse(domain),
          status: domain === 'post' ? PostStatus.ARCHIVED : WorkStatus.ARCHIVED,
        },
        blockMedia: [],
      });
      expect(await r.view('entry', { requestedLocale: 'en' })).toMatchObject({ status: 'archived' });
      expect(await r.metadata('entry', { requestedLocale: 'en' })).toMatchObject({ kind: domain });
      expect(r.get).toHaveBeenCalledTimes(2);
    });

    it('preserves NotFound nulls and authorization errors without dispatching a second Get', async () => {
      const r = await domainReaders();
      r.get.mockRejectedValue(new ConnectError('missing', Code.NotFound));
      expect(await r.view('entry', { requestedLocale: 'en' })).toBeNull();
      expect(await r.metadata('entry', { requestedLocale: 'en' })).toBeNull();
      expect(r.get).toHaveBeenCalledTimes(1);
      mocks.requestId += 1;
      const denied = new ConnectError('denied', Code.PermissionDenied);
      r.get.mockRejectedValue(denied);
      await expect(r.view('entry', { requestedLocale: 'en' })).rejects.toBe(denied);
      expect(await r.metadata('entry', { requestedLocale: 'en' })).toBeNull();
      expect(r.get).toHaveBeenCalledTimes(2);
    });
  });
}
