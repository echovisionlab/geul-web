import { resolveErrorStatus } from '@/features/application-error/error-status';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/utils/logger', () => ({ createLogger: () => ({ error: vi.fn(), warn: vi.fn() }) }));
vi.mock('@/lib/utils/session.server', () => ({ getSession: async () => ({ user: { id: 'member', role: 'admin' } }) }));
vi.mock('@/lib/api/server-client', () => ({
  createReleaseClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createEmailTemplateClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createMapThemeClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createArtistClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicArtistClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicArtistClientWithAuth: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createAudienceClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createCampaignClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createCategoryClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createClientClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicClientClientWithAuth: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createCommentClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createEmailSuppressionClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createFormClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicFormClientWithAuth: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createFormatClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createGenreClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createLabelClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicLabelClientWithAuth: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createMapPlaceClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicMapPlaceClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicMapPlaceClientWithAuth: () =>
    new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createFileClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createProgramEventClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createProgramEventSeriesClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createProgramEventTypeClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createAccountClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createShareLinkClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createStyleClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createTagClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createTrackClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createMemberClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createPublicWorkClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
  createWorkClient: () => new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : mocks.rpc) }),
}));
const cases: Array<[string, string, unknown[]]> = [
  ['artist', 'listArtistsAction', []],
  ['artist', 'listArtistParentOptionsAction', ['00000000-0000-4000-8000-000000000001']],
  ['artist', 'listMyArtistsAction', [{}]],
  ['artist', 'listArtistsForBlockAction', [{}]],
  ['artist', 'listArtistParticipantsAction', ['00000000-0000-4000-8000-000000000001']],
  ['audience', 'listSegmentsAdminAction', [{}]],
  ['campaign', 'listCampaignsAction', [{}]],
  ['campaign', 'getCampaignAction', ['00000000-0000-4000-8000-000000000001']],
  ['campaign', 'getCampaignStatsAction', ['00000000-0000-4000-8000-000000000001']],
  ['campaign', 'getCampaignRecipientsAction', ['00000000-0000-4000-8000-000000000001', 20, 0]],
  ['campaign', 'previewCampaignAction', ['00000000-0000-4000-8000-000000000001', {}]],
  ['category', 'listCategoriesAction', []],
  ['client', 'listClientsForBlockAction', [{}]],
  ['client', 'getClientsForBlockByIdsAction', [{ ids: ['00000000-0000-4000-8000-000000000001'] }]],
  ['comment', 'listCommentsAction', ['00000000-0000-4000-8000-000000000001', {}]],
  ['comment', 'loadMoreRepliesAction', ['00000000-0000-4000-8000-000000000001', {}]],
  ['email-suppression', 'getEmailSuppressionAction', ['test@example.com']],
  ['form', 'listFormsAdminAction', [{}]],
  [
    'form',
    'verifyFormPasswordAction',
    [
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
    ],
  ],
  ['form', 'getFormDashboardByShareAction', [{ slug: 'form', shareToken: 'share' }]],
  ['form', 'getFormSubmissionStatsAction', ['00000000-0000-4000-8000-000000000001']],
  ['format', 'listFormatsAction', []],
  ['format', 'listFormatsAdminAction', [{}]],
  ['genre', 'listGenresAction', []],
  ['genre', 'listGenresAdminAction', [{}]],
  ['label', 'previewDeleteLabelAction', ['00000000-0000-4000-8000-000000000001']],
  ['label', 'listLabelParticipantsAction', ['00000000-0000-4000-8000-000000000001']],
  ['label', 'listLabelsForBlockAction', [{}]],
  ['label', 'getLabelsForBlockByIdsAction', [{ ids: ['00000000-0000-4000-8000-000000000001'] }]],
  ['map-place', 'listMapPlacesAdminAction', [{}]],
  ['map-place', 'getMapPlacesByIdsAction', [['00000000-0000-4000-8000-000000000001']]],
  ['map-place', 'getPublicMapPlacesByIdsAction', [['00000000-0000-4000-8000-000000000001'], 'ko']],
  ['program-event', 'searchArtistsForProgramEventCreditAction', ['00000000-0000-4000-8000-000000000001', 'artist']],
  ['session', 'listSessionsAction', []],
  ['share-link', 'listShareLinksAction', [1, '00000000-0000-4000-8000-000000000001']],
  ['style', 'listStylesAction', []],
  ['style', 'listStylesAdminAction', [{}]],
  ['tag', 'listTagsAction', []],
  ['track', 'getReleaseTrackSnapshotAction', ['00000000-0000-4000-8000-000000000001']],
  ['user-tag', 'listUserTagsAdminAction', [{}]],
  ['user-tag', 'listAllUserTagsAction', []],
  ['user', 'listUsersAdminAction', [{}]],
  ['user', 'getUserAdminAction', ['00000000-0000-4000-8000-000000000001']],
  ['work', 'listWorksPublishedAction', [{}]],
  ['work', 'listWorksAdminAction', [{}]],
  ['work', 'searchArtistsForCreditAction', ['00000000-0000-4000-8000-000000000001', 'artist']],
  ['work', 'listMyCreditedWorksAction', [{}]],
];
beforeEach(() => {
  mocks.rpc.mockReset();
});
describe.each(cases)('%s.%s serializable read failures', (module, name, args) => {
  it.each([
    [Code.InvalidArgument, 400],
    [Code.Unauthenticated, 401],
    [Code.PermissionDenied, 403],
    [Code.ResourceExhausted, 429],
    [Code.Unavailable, 503],
    [Code.DeadlineExceeded, 504],
    [Code.Internal, 500],
  ])('preserves code %s as status %s across JSON without diagnostics', async (code, status) => {
    mocks.rpc.mockRejectedValue(new ConnectError('private upstream credential diagnostic', code));
    const actionModule = await import(/* @vite-ignore */ `./${module}`);
    const result = await actionModule[name](...args);
    expect(mocks.rpc).toHaveBeenCalled();
    const transferred = JSON.parse(JSON.stringify(result));
    expect(transferred).toMatchObject({ ok: false, status });
    expect(transferred).not.toHaveProperty('value');
    expect(JSON.stringify(transferred)).not.toContain('private upstream');
  });
});

const detailCases: Array<[string, string, unknown[]]> = [
  ['artist', 'getArtistAdminAction', ['00000000-0000-4000-8000-000000000001']],
  ['email-template', 'getEmailTemplateAction', ['template']],
  ['email-template', 'previewEmailTemplateAction', [{ id: 'template' }]],
  ['map-place', 'getMapPlaceAction', ['place']],
  ['map-theme', 'getMapThemeByIdAction', ['theme']],
  ['release', 'getReleaseAdminAction', ['00000000-0000-4000-8000-000000000001']],
  ['release', 'getReleaseEditorRelationsAction', ['release']],
];
describe.each(detailCases)('%s.%s conditional detail failures', (module, name, args) => {
  it.each([
    [Code.InvalidArgument, 400],
    [Code.ResourceExhausted, 429],
    [Code.Unavailable, 503],
    [Code.DeadlineExceeded, 504],
    [Code.Internal, 500],
  ])('preserves code %s as status %s after production sanitization', async (code, status) => {
    mocks.rpc.mockRejectedValue(new ConnectError('private provider diagnostic', code));
    const actionModule = await import(/* @vite-ignore */ `./${module}`);
    let failure: unknown;
    try {
      await actionModule[name](...args);
    } catch (error) {
      failure = error;
    }
    expect(mocks.rpc).toHaveBeenCalled();
    expect(failure).toHaveProperty('digest');
    const transported = {
      digest: (failure as { digest: string }).digest,
      message: 'An error occurred in the Server Components render.',
    };
    expect(resolveErrorStatus(transported)).toBe(status);
    expect(JSON.stringify(transported)).not.toContain('private');
  });
  it('keeps the explicit NotFound null contract', async () => {
    mocks.rpc.mockRejectedValue(new ConnectError('missing', Code.NotFound));
    const actionModule = await import(/* @vite-ignore */ `./${module}`);
    expect(await actionModule[name](...args)).toBeNull();
  });
});
