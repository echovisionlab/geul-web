import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/lib/api/browser/secure-admin', () => ({
  createAdminClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
}));

vi.mock('@/lib/api/server-client', () => ({
  createPublicProgramEventSeriesClientWithAuth: () =>
    new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createClientClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createFileClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createFormClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createLabelClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createMemberClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPageClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPrivacyClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createProgramEventClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createProgramEventSeriesClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createProgramEventTypeClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicArtistClientWithAuth: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicCategoryClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicLabelClientWithAuth: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicMemberClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicPageClientWithAuth: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicPostClientWithAuth: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicProgramEventClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicProgramEventClientWithAuth: () =>
    new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicReleaseClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicReleaseClientWithAuth: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicSeriesClientWithAuth: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicTagClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicWorkClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicWorkClientWithAuth: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createReleaseClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createSeriesClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createSiteSettingClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createTermsClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createWorkClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
}));

vi.mock('@/lib/api/browser/secure-client', () => ({
  createClientClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
}));

vi.mock('@/lib/api/browser/secure-label', () => ({
  createLabelClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
}));

vi.mock('@/lib/api/browser/secure-menu', () => ({
  createMenuClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
}));

vi.mock('@/lib/api/browser/public-privacy', () => ({
  createPublicPrivacyClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicPrivacyClientWithLocale: () =>
    new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
}));

vi.mock('@/lib/api/browser/public-program-event', () => ({
  createPublicProgramEventClientWithLocale: () =>
    new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicProgramEventSeriesClientWithLocale: () =>
    new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicProgramEventTypeClientWithLocale: () =>
    new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
}));

vi.mock('@/lib/api/browser/secure-site-setting', () => ({
  createSiteSettingClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
}));

vi.mock('@/lib/api/browser/public-terms', () => ({
  createPublicTermsClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicTermsClientWithLocale: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
}));

vi.mock('@/lib/api/browser/secure-member', () => ({
  createMemberClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
}));

vi.mock('@/lib/utils/logger', () => ({ createLogger: () => ({ error: vi.fn(), warn: vi.fn() }) }));
vi.mock('@/lib/utils/client-logger', () => ({
  createClientLogger: () => ({ error: vi.fn() }),
  serializeClientLogError: (error: unknown) => error,
}));

beforeEach(() => {
  mocks.rpc.mockReset();
});

const cases: Array<[string, string, unknown[]]> = [
  ['admin-browser', 'getAdminStats', []],
  ['artist', 'getArtistView', ['artist']],
  ['client-browser', 'searchClients', ['needle']],
  ['client-browser', 'listClientsForSelector', []],
  ['client', 'listClientsAdmin', [{}]],
  ['form', 'getFormSettingsMeta', ['form']],
  ['form', 'getFormEditorInitialFields', ['form']],
  ['form', 'getFormSubmissionWithSchema', ['submission']],
  ['label-browser', 'listLabelsForSelector', []],
  ['label', 'getLabelPublic', ['label']],
  ['menu-browser', 'listMenus', []],
  ['menu-browser', 'getMenuById', ['menu']],
  ['page', 'listPagesAdmin', [{}]],
  ['page', 'getPage', ['00000000-0000-0000-0000-000000000001']],
  ['privacy-browser', 'listArchivedPrivacy', []],
  ['privacy', 'listPrivacyVersions', []],
  ['program-event-browser', 'listProgramEventTypeOptionsBrowser', []],
  ['program-event-browser', 'listProgramEventSeriesOptionsBrowser', []],
  ['program-event', 'getProgramEventSeriesView', ['series']],
  ['release', 'listPublishedReleases', [{}]],
  ['series', 'listSeriesSimple', []],
  ['site-setting-browser', 'getAllSiteSettings', []],
  ['site-setting-browser', 'getOgConfig', []],
  ['site-setting', 'getAllSiteSettings', []],
  ['taxonomy', 'getPublicCategoryBySlug', ['category']],
  ['taxonomy', 'getPublicTagBySlug', ['tag']],
  ['terms-browser', 'listArchivedTerms', []],
  ['terms', 'listTermsVersions', []],
  ['user-browser', 'searchMembers', ['member']],
  ['user', 'getUserProfileView', [null, null, 'member']],
  ['user', 'getUserPublishedPosts', ['member']],
  ['user', 'listAuthors', []],
  ['work', 'listWorksForGallery', []],
];

const modules = {
  'admin-browser': () => import('./admin-browser'),
  artist: () => import('./artist'),
  client: () => import('./client'),
  'client-browser': () => import('./client-browser'),
  form: () => import('./form'),
  label: () => import('./label'),
  'label-browser': () => import('./label-browser'),
  'menu-browser': () => import('./menu-browser'),
  page: () => import('./page'),
  privacy: () => import('./privacy'),
  'privacy-browser': () => import('./privacy-browser'),
  'program-event': () => import('./program-event'),
  'program-event-browser': () => import('./program-event-browser'),
  release: () => import('./release'),
  series: () => import('./series'),
  'site-setting': () => import('./site-setting'),
  'site-setting-browser': () => import('./site-setting-browser'),
  taxonomy: () => import('./taxonomy'),
  terms: () => import('./terms'),
  'terms-browser': () => import('./terms-browser'),
  user: () => import('./user'),
  'user-browser': () => import('./user-browser'),
  work: () => import('./work'),
};

async function invoke(file: string, name: string, args: unknown[]) {
  const module = await modules[file as keyof typeof modules]();
  return (module as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)[name](...args);
}

describe.each(cases)('%s.%s failure contract', (file, name, args) => {
  it.each([
    Code.Unauthenticated,
    Code.PermissionDenied,
    Code.InvalidArgument,
    Code.ResourceExhausted,
    Code.Unavailable,
    Code.DeadlineExceeded,
    Code.Internal,
  ])('preserves RPC failure code %s', async (code) => {
    const error = new ConnectError('private upstream diagnostics', code);
    mocks.rpc.mockRejectedValue(error);
    // Public hidden resources retain the existing non-disclosure contract.
    if (code === Code.PermissionDenied && ['getLabelPublic', 'getProgramEventSeriesView'].includes(name)) {
      await expect(invoke(file, name, args)).resolves.toBeNull();
    } else {
      await expect(invoke(file, name, args)).rejects.toBe(error);
    }
  });
  it('does not turn a transport failure into empty success', async () => {
    const error = new Error('transport failed');
    mocks.rpc.mockRejectedValue(error);
    await expect(invoke(file, name, args)).rejects.toBe(error);
  });
});

it.each(
  cases.filter(([, name]) =>
    [
      'getArtistView',
      'getLabelPublic',
      'getPage',
      'getMenuById',
      'getFormSettingsMeta',
      'getFormEditorInitialFields',
      'getFormSubmissionWithSchema',
      'getUserProfileView',
      'getProgramEventSeriesView',
      'getPublicCategoryBySlug',
      'getPublicTagBySlug',
    ].includes(name),
  ),
)('%s.%s preserves absent-resource null', async (file, name, args) => {
  mocks.rpc.mockRejectedValue(new ConnectError('not found', Code.NotFound));
  await expect(invoke(file, name, args)).resolves.toBeNull();
});

describe('stored form corruption', () => {
  it.each(['{', 'null', '{}', '[]'])(
    'rejects invalid editor schema %s instead of initialising an empty editor',
    async (schema) => {
      mocks.rpc.mockResolvedValue({ title: 'saved form', schema: new TextEncoder().encode(schema) });
      await expect(invoke('form', 'getFormEditorInitialFields', ['form'])).rejects.toThrow();
    },
  );
  it.each(['{', 'null', '[]', '1'])('rejects malformed submission data %s', async (data) => {
    mocks.rpc.mockResolvedValue({ submission: { id: 'submission', data: new TextEncoder().encode(data) } });
    await expect(invoke('form', 'getFormSubmissionWithSchema', ['submission'])).rejects.toThrow();
  });
});
it('rejects a missing required settings payload rather than loading forever', async () => {
  mocks.rpc.mockResolvedValue({});
  await expect(invoke('site-setting-browser', 'getAllSiteSettings', [])).rejects.toMatchObject({ code: Code.Internal });
});
it.each([
  ['client-browser', 'searchClients', ['needle'], { clients: [] }],
  ['label-browser', 'listLabelsForSelector', [], { labels: [] }],
  ['user-browser', 'searchMembers', ['needle'], { members: [] }],
  ['menu-browser', 'listMenus', [], { menus: [], pagination: { hasMore: false } }],
])('preserves true empty success for %s.%s', async (file, name, args, response) => {
  mocks.rpc.mockResolvedValue(response);
  await expect(invoke(file as string, name as string, args as unknown[])).resolves.toEqual([]);
});
